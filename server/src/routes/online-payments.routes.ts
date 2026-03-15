import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../config/database.js';
import { userApartments, organizations } from '../db/schema/index.js';
import * as paymentGateway from '../services/payment-gateway.service.js';

export const onlinePaymentRoutes = Router();

const checkoutSchema = z.object({
  apartmentId: z.string().uuid(),
  amount: z.number().positive(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  gateway: z.enum(['stripe', 'cardcom', 'paypal']),
});

// Create checkout session (tenant-facing)
onlinePaymentRoutes.post('/checkout', requireAuth, validate(checkoutSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apartmentId, amount, month, gateway } = req.body;
    const orgId = req.user!.organizationId;
    if (!orgId) { res.status(400).json({ error: 'No organization context' }); return; }

    // Check if online payments are enabled for this org
    const [org] = await db.select({ onlinePaymentsEnabled: organizations.onlinePaymentsEnabled }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org?.onlinePaymentsEnabled) { res.status(403).json({ error: 'Online payments are not enabled for this organization' }); return; }

    // Verify tenant owns this apartment
    const [assignment] = await db.select().from(userApartments)
      .where(and(eq(userApartments.userId, req.user!.userId), eq(userApartments.apartmentId, apartmentId)))
      .limit(1);
    if (!assignment) { res.status(403).json({ error: 'Not authorized for this apartment' }); return; }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const successUrl = `${baseUrl}/my-apartments?payment=success`;
    const cancelUrl = `${baseUrl}/my-apartments?payment=cancelled`;

    // Detect locale from Cloudflare country header
    const country = (req.headers['cf-ipcountry'] as string || '').toUpperCase();
    const locale = country === 'IL' ? 'he' : 'en';

    if (gateway === 'stripe') {
      const result = await paymentGateway.createStripeCheckoutSession(orgId, apartmentId, amount, month, successUrl, cancelUrl, locale);
      res.json(result);
    } else if (gateway === 'paypal') {
      const result = await paymentGateway.createPaypalOrder(orgId, apartmentId, amount, month, successUrl, cancelUrl);
      res.json({ url: result.approveUrl, orderId: result.orderId });
    } else if (gateway === 'cardcom') {
      const result = await paymentGateway.createCardcomSession(orgId, apartmentId, amount, month, successUrl, cancelUrl, locale);
      res.json(result);
    }
  } catch (err) { next(err); }
});

// Stripe webhook (no auth — Stripe calls this)
onlinePaymentRoutes.post('/stripe-webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) { res.status(400).json({ error: 'Missing stripe-signature' }); return; }

    // Parse raw body to extract metadata first
    const rawBody = req.body; // raw Buffer due to express.raw middleware
    let eventData: any;
    try {
      eventData = JSON.parse(rawBody.toString());
    } catch {
      res.status(400).json({ error: 'Invalid payload' }); return;
    }

    // Extract orgId from the event's session metadata
    const session = eventData?.data?.object;
    const orgId = session?.metadata?.organizationId;
    if (!orgId) { res.status(400).json({ error: 'Missing organization context' }); return; }

    // Now verify signature with the org's webhook secret
    await paymentGateway.handleStripeWebhook(rawBody, signature, orgId);
    res.json({ received: true });
  } catch (err) { next(err); }
});

// PayPal return handler (captures the order after user approves)
onlinePaymentRoutes.get('/paypal-return', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = req.query.token as string;
    const orgId = req.user!.organizationId;
    if (!orgId || !orderId) { res.redirect('/my-apartments?payment=error'); return; }

    await paymentGateway.capturePaypalOrder(orgId, orderId);
    res.redirect('/my-apartments?payment=success');
  } catch {
    res.redirect('/my-apartments?payment=error');
  }
});

// CardCom webhook (verifies server-to-server via Low Profile API)
onlinePaymentRoutes.post('/cardcom-webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await paymentGateway.handleCardcomWebhook(req.body);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

