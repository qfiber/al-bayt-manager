import Stripe from 'stripe';
import { db } from '../config/database.js';
import { organizationSubscriptions, subscriptionPlans, organizations } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import { getRawSettings } from './settings.service.js';
import { generateInvoice } from './subscription.plan.service.js';

async function getStripe(): Promise<Stripe> {
  // Use the global/super-admin settings for SaaS billing (not per-org)
  const config = await getRawSettings();
  if (!config?.stripeSecretKey) throw new AppError(400, 'Stripe is not configured');
  return new Stripe(config.stripeSecretKey);
}

export async function createCheckoutSession(
  organizationId: string,
  planId: string,
  billingCycle: 'monthly' | 'semi_annual' | 'yearly',
  successUrl: string,
  cancelUrl: string,
) {
  const stripe = await getStripe();

  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
  if (!plan) throw new AppError(404, 'Plan not found');

  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) throw new AppError(404, 'Organization not found');

  // Determine price and interval
  let amount: number;
  let interval: 'month' | 'year';
  let intervalCount = 1;

  if (billingCycle === 'yearly' && plan.yearlyPrice) {
    amount = Math.round(parseFloat(plan.yearlyPrice) * 100);
    interval = 'year';
  } else if (billingCycle === 'semi_annual' && plan.semiAnnualPrice) {
    amount = Math.round(parseFloat(plan.semiAnnualPrice) * 100);
    interval = 'month';
    intervalCount = 6;
  } else {
    amount = Math.round(parseFloat(plan.monthlyPrice) * 100);
    interval = 'month';
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: (plan.currency || 'usd').toLowerCase(),
        product_data: { name: `${plan.name} Plan — ${org.name}` },
        unit_amount: amount,
        recurring: { interval, interval_count: intervalCount },
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { organizationId, planId, billingCycle },
    client_reference_id: organizationId,
  });

  return { sessionId: session.id, url: session.url };
}

export async function handleWebhook(payload: Buffer, signature: string) {
  const stripe = await getStripe();
  const config = await getRawSettings();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, config?.stripeWebhookSecret || '');
  } catch {
    throw new AppError(400, 'Invalid webhook signature');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const { organizationId, planId, billingCycle } = session.metadata || {};
      if (!organizationId || !planId) break;

      // Activate subscription
      const { assignPlan } = await import('./subscription.plan.service.js');
      await assignPlan(organizationId, planId, billingCycle || 'monthly');

      // Store Stripe IDs
      const stripeSubscriptionId = session.subscription as string;
      const stripeCustomerId = session.customer as string;

      await db.update(organizationSubscriptions)
        .set({ stripeCustomerId, stripeSubscriptionId, updatedAt: new Date() })
        .where(eq(organizationSubscriptions.organizationId, organizationId));

      // Reactivate org if it was suspended
      await db.update(organizations)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(organizations.id, organizationId));

      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      // Find org by stripe customer ID
      const [sub] = await db.select().from(organizationSubscriptions)
        .where(eq(organizationSubscriptions.stripeCustomerId, customerId)).limit(1);

      if (sub) {
        const amount = ((invoice.amount_paid || 0) / 100).toFixed(2);
        const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000) : new Date();
        const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : new Date();

        await generateInvoice(sub.organizationId, amount, sub.billingCycle, periodStart, periodEnd);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const [sub] = await db.select().from(organizationSubscriptions)
        .where(eq(organizationSubscriptions.stripeCustomerId, customerId)).limit(1);

      if (sub) {
        await db.update(organizationSubscriptions)
          .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
          .where(eq(organizationSubscriptions.id, sub.id));
      }
      break;
    }
  }
}
