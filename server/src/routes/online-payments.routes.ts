import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../config/database.js';
import { userApartments } from '../db/schema/index.js';
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

    // Verify tenant owns this apartment
    const [assignment] = await db.select().from(userApartments)
      .where(and(eq(userApartments.userId, req.user!.userId), eq(userApartments.apartmentId, apartmentId)))
      .limit(1);
    if (!assignment) { res.status(403).json({ error: 'Not authorized for this apartment' }); return; }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const successUrl = `${baseUrl}/my-apartments?payment=success`;
    const cancelUrl = `${baseUrl}/my-apartments?payment=cancelled`;

    if (gateway === 'stripe') {
      const result = await paymentGateway.createStripeCheckoutSession(orgId, apartmentId, amount, month, successUrl, cancelUrl);
      res.json(result);
    } else if (gateway === 'paypal') {
      const result = await paymentGateway.createPaypalOrder(orgId, apartmentId, amount, month, successUrl, cancelUrl);
      res.json({ url: result.approveUrl, orderId: result.orderId });
    } else {
      const result = await paymentGateway.createCardcomPaymentPage(orgId, apartmentId, amount, month, successUrl, cancelUrl);
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

// CardCom callback — add basic validation
onlinePaymentRoutes.post('/cardcom-callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verify required CardCom fields exist
    if (!req.body.ResponseCode && !req.body.OperationResponse) {
      res.status(400).json({ error: 'Invalid callback data' });
      return;
    }
    await paymentGateway.handleCardcomCallback(req.body);
    res.json({ success: true });
  } catch (err) { next(err); }
});
