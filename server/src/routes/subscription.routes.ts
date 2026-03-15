import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { requireOrgScope, requireSuperAdmin } from '../middleware/org-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as subService from '../services/subscription.plan.service.js';
import * as stripeSubService from '../services/stripe-subscription.service.js';

export const subscriptionRoutes = Router();

const idParams = z.object({ id: z.string().uuid() });

const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  maxBuildings: z.number().int().min(0),
  maxApartmentsPerBuilding: z.number().int().min(0),
  monthlyPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  semiAnnualPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  yearlyPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().max(10).optional(),
  isCustom: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

const assignPlanSchema = z.object({
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'semi_annual', 'yearly']),
});

// ---- Plans CRUD (super-admin) ----

subscriptionRoutes.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.listPlans();
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.post('/plans', requireAuth, requireSuperAdmin, validate(createPlanSchema), auditLog('create', 'subscription_plans'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.createPlan(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.put('/plans/:id', requireAuth, requireSuperAdmin, validate({ params: idParams, body: createPlanSchema.partial() }), auditLog('update', 'subscription_plans'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.updatePlan(req.params.id as string, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.delete('/plans/:id', requireAuth, requireSuperAdmin, validate({ params: idParams }), auditLog('delete', 'subscription_plans'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.deletePlan(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

// ---- Subscription management ----

subscriptionRoutes.get('/current', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.json(null); return; }
    const result = await subService.getOrgSubscription(req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.post('/assign', requireAuth, requireSuperAdmin, validate(assignPlanSchema), auditLog('update', 'organization_subscriptions'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.assignPlan(req.body.organizationId, req.body.planId, req.body.billingCycle);
    res.json(result);
  } catch (err) { next(err); }
});

// Super-admin: assign trial to an org
subscriptionRoutes.post('/assign-trial', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, planId } = req.body;
    if (!organizationId) { res.status(400).json({ error: 'Missing organizationId' }); return; }
    const result = await subService.startTrial(organizationId, planId);
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.post('/cancel', requireAuth, requireOrgScope, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }
    const result = await subService.cancelSubscription(req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

// ---- Self-service plan change ----

const changePlanSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'semi_annual', 'yearly']),
});

// Super-admin only — direct plan assignment without payment
subscriptionRoutes.post('/change-plan', requireAuth, requireSuperAdmin, validate(changePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }
    const { planId, billingCycle } = req.body;
    const result = await subService.assignPlan(req.organizationId, planId, billingCycle);
    res.json(result);
  } catch (err) { next(err); }
});

// ---- Invoices ----

subscriptionRoutes.get('/invoices', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.json([]); return; }
    const result = await subService.listOrgInvoices(req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.get('/all-invoices', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.listAllInvoices();
    res.json(result);
  } catch (err) { next(err); }
});

// ---- Stripe subscription (landlord self-service) ----

// Stripe checkout for SaaS subscription (landlord self-service)
subscriptionRoutes.post('/stripe-checkout', requireAuth, requireOrgScope, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }
    const { planId, billingCycle } = req.body;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = await stripeSubService.createCheckoutSession(
      req.organizationId, planId, billingCycle,
      `${baseUrl}/dashboard?subscription=success`,
      `${baseUrl}/dashboard?subscription=cancelled`,
    );
    res.json(result);
  } catch (err) { next(err); }
});

// Stripe webhook for SaaS subscriptions
subscriptionRoutes.post('/stripe-webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) { res.status(400).json({ error: 'Missing signature' }); return; }
    await stripeSubService.handleWebhook(req.body, signature);
    res.json({ received: true });
  } catch (err) { next(err); }
});

// ---- CardCom subscription (landlord self-service) ----

// CardCom checkout for SaaS subscription
subscriptionRoutes.post('/cardcom-checkout', requireAuth, requireOrgScope, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }
    const { planId, billingCycle } = req.body;

    const plan = await subService.getPlan(planId);
    let amount = parseFloat(plan.monthlyPrice);
    if (billingCycle === 'semi_annual' && plan.semiAnnualPrice) amount = parseFloat(plan.semiAnnualPrice);
    if (billingCycle === 'yearly' && plan.yearlyPrice) amount = parseFloat(plan.yearlyPrice);

    const country = (req.headers['cf-ipcountry'] as string || '').toUpperCase();
    const locale = country === 'IL' ? 'he' : 'en';

    const { getRawSettings } = await import('../services/settings.service.js');
    const config = await getRawSettings();
    if (!config?.cardcomEnabled || !config.cardcomTerminalNumber) {
      throw new Error('CardCom is not configured');
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const successUrl = `${baseUrl}/dashboard?subscription=success`;
    const failedUrl = `${baseUrl}/dashboard?subscription=failed`;
    const webhookUrl = `${baseUrl}/api/subscriptions/cardcom-webhook`;

    const body = {
      TerminalNumber: parseInt(config.cardcomTerminalNumber),
      ApiName: config.cardcomApiName || '',
      ApiPassword: config.cardcomApiPassword || '',
      Operation: 'ChargeOnly',
      Amount: amount,
      ProductName: `${plan.name} Plan - ${billingCycle}`,
      Language: locale,
      ISOCoinId: 1, // ILS
      ReturnValue: JSON.stringify({ orgId: req.organizationId, planId, billingCycle }),
      SuccessRedirectUrl: successUrl,
      FailedRedirectUrl: failedUrl,
      WebHookUrl: webhookUrl,
    };

    const cardcomRes = await fetch('https://secure.cardcom.solutions/api/v11/LowProfile/Create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await cardcomRes.json() as any;
    if (!cardcomRes.ok || !data.LowProfileId) {
      const logger = (await import('../config/logger.js')).default;
      logger.error({ status: cardcomRes.status, response: data, terminal: config.cardcomTerminalNumber }, 'CardCom LowProfile/Create failed');
      throw new Error(`CardCom failed: ${data.Description || data.Message || JSON.stringify(data)}`);
    }

    res.json({
      lowProfileId: data.LowProfileId,
      url: data.Url || `https://secure.cardcom.solutions/external/LowProfile/${data.LowProfileId}`,
      isIsrael: country === 'IL',
    });
  } catch (err) { next(err); }
});

// Super-admin: generate a CardCom payment link for a specific org (manual invoicing)
subscriptionRoutes.post('/generate-payment-link', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, planId, billingCycle } = req.body;

    const plan = await subService.getPlan(planId);
    let amount = parseFloat(plan.monthlyPrice);
    if (billingCycle === 'semi_annual' && plan.semiAnnualPrice) amount = parseFloat(plan.semiAnnualPrice);
    if (billingCycle === 'yearly' && plan.yearlyPrice) amount = parseFloat(plan.yearlyPrice);

    const { getRawSettings } = await import('../services/settings.service.js');
    const config = await getRawSettings();
    if (!config?.cardcomEnabled || !config.cardcomTerminalNumber) {
      throw new Error('CardCom is not configured');
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const successUrl = `${baseUrl}/dashboard?subscription=success`;
    const failedUrl = `${baseUrl}/dashboard?subscription=failed`;
    const webhookUrl = `${baseUrl}/api/subscriptions/cardcom-webhook`;

    const body = {
      TerminalNumber: parseInt(config.cardcomTerminalNumber),
      ApiName: config.cardcomApiName || '',
      ApiPassword: config.cardcomApiPassword || '',
      Operation: 'ChargeOnly',
      Amount: amount,
      ProductName: `${plan.name} Plan - ${billingCycle}`,
      Language: 'en',
      ISOCoinId: 1,
      ReturnValue: JSON.stringify({ orgId: organizationId, planId, billingCycle }),
      SuccessRedirectUrl: successUrl,
      FailedRedirectUrl: failedUrl,
      WebHookUrl: webhookUrl,
    };

    const cardcomRes = await fetch('https://secure.cardcom.solutions/api/v11/LowProfile/Create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await cardcomRes.json() as any;
    if (!cardcomRes.ok || !data.LowProfileId) {
      const logger = (await import('../config/logger.js')).default;
      logger.error({ status: cardcomRes.status, response: data, terminal: config.cardcomTerminalNumber }, 'CardCom LowProfile/Create failed');
      throw new Error(`CardCom failed: ${data.Description || data.Message || JSON.stringify(data)}`);
    }

    const url = data.Url || `https://secure.cardcom.solutions/external/LowProfile/${data.LowProfileId}`;
    res.json({ url, amount });
  } catch (err) { next(err); }
});

// CardCom subscription webhook callback
subscriptionRoutes.post('/cardcom-webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const returnValueRaw = req.body.ReturnValue || '';
    const lowProfileId = req.body.LowProfileId || req.body.InternalDealNumber?.toString() || '';

    if (!lowProfileId) { res.json({ ok: true }); return; }

    let returnValue: any;
    try { returnValue = JSON.parse(returnValueRaw); } catch { res.json({ ok: true }); return; }

    const { orgId, planId, billingCycle } = returnValue || {};
    if (!orgId || !planId) { res.json({ ok: true }); return; }

    // Verify payment server-to-server
    const { verifyCardcomPayment } = await import('../services/payment-gateway.service.js');
    const verification = await verifyCardcomPayment(lowProfileId, orgId);
    if (!verification.verified) { res.json({ ok: false }); return; }

    // Activate subscription
    await subService.assignPlan(orgId, planId, billingCycle || 'monthly');

    // Reactivate org if suspended
    const { organizations } = await import('../db/schema/index.js');
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../config/database.js');
    await db.update(organizations).set({ isActive: true, updatedAt: new Date() }).where(eq(organizations.id, orgId));

    // Create EZCount invoice
    try {
      const { createEZCountInvoice } = await import('../services/ezcount.service.js');
      await createEZCountInvoice(orgId, {
        transactionId: verification.transactionId,
        description: `${planId} Plan - ${billingCycle}`,
        amount: verification.amount,
        currency: 'ILS',
        ccLast4: verification.ccLast4,
      }, 'he');
    } catch {}

    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

// ---- Metrics (super-admin) ----

subscriptionRoutes.get('/metrics', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.getSubscriptionMetrics();
    res.json(result);
  } catch (err) { next(err); }
});
