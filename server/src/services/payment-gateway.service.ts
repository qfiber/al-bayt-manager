import Stripe from 'stripe';
import { db } from '../config/database.js';
import { apartments, buildings } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import * as paymentService from './payment.service.js';
import { getRawSettings } from './settings.service.js';

async function getOrgSettings(organizationId: string) {
  const config = await getRawSettings(organizationId);
  if (!config) throw new AppError(500, 'Organization settings not found');
  return config;
}

// ============ STRIPE ============

export async function createStripeCheckoutSession(
  organizationId: string,
  apartmentId: string,
  amount: number,
  month: string,
  successUrl: string,
  cancelUrl: string,
  locale: string = 'en',
): Promise<{ sessionId: string; url: string }> {
  const config = await getOrgSettings(organizationId);
  if (!config.stripeEnabled || !config.stripeSecretKey) {
    throw new AppError(400, 'Stripe is not configured');
  }

  const stripe = new Stripe(config.stripeSecretKey);

  const [apt] = await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
  if (!apt) throw new AppError(404, 'Apartment not found');

  const [bldg] = await db.select({ orgId: buildings.organizationId }).from(buildings).where(eq(buildings.id, apt.buildingId)).limit(1);
  if (bldg?.orgId !== organizationId) throw new AppError(403, 'Apartment does not belong to this organization');

  const [building] = await db.select({ name: buildings.name }).from(buildings).where(eq(buildings.id, apt.buildingId)).limit(1);

  const session = await stripe.checkout.sessions.create({
    locale: locale === 'he' ? 'auto' : 'en' as any,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: config.currencyCode.toLowerCase(),
        product_data: {
          name: `Payment for ${building?.name || 'Building'} - Apt ${apt.apartmentNumber} (${month})`,
        },
        unit_amount: Math.round(amount * 100), // Stripe uses cents
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      apartmentId,
      month,
      organizationId,
    },
  });

  return { sessionId: session.id, url: session.url! };
}

export async function handleStripeWebhook(
  payload: Buffer,
  signature: string,
  organizationId: string,
): Promise<void> {
  const config = await getOrgSettings(organizationId);
  if (!config.stripeSecretKey || !config.stripeWebhookSecret) {
    throw new AppError(400, 'Stripe webhook not configured');
  }

  const stripe = new Stripe(config.stripeSecretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);
  } catch {
    throw new AppError(400, 'Invalid webhook signature');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { apartmentId, month } = session.metadata || {};

    if (apartmentId && month && session.payment_status === 'paid') {
      const amountPaid = (session.amount_total || 0) / 100;
      // Create the payment record (same as manual payment creation)
      // Use a system user ID for automated payments
      await paymentService.createPayment({
        apartmentId,
        month,
        amount: amountPaid,
      }, 'system');

      // Auto-generate invoice
      try {
        const { createInvoice } = await import('./receipt.service.js');
        await createInvoice(apartmentId, month);
      } catch {
        // Don't fail payment if invoice generation fails
      }
    }
  }
}

// ============ CARDCOM (Low Profile API) ============

export async function createCardcomSession(
  organizationId: string,
  apartmentId: string,
  amount: number,
  month: string,
  successUrl: string,
  failedUrl: string,
  locale: string = 'he',
): Promise<{ lowProfileId: string }> {
  const config = await getOrgSettings(organizationId);
  if (!config.cardcomEnabled || !config.cardcomTerminalNumber) {
    throw new AppError(400, 'CardCom is not configured');
  }

  const [apt] = await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
  if (!apt) throw new AppError(404, 'Apartment not found');

  const [bldg] = await db.select({ name: buildings.name, orgId: buildings.organizationId }).from(buildings).where(eq(buildings.id, apt.buildingId)).limit(1);
  if (bldg?.orgId !== organizationId) throw new AppError(403, 'Apartment does not belong to this organization');

  const body = {
    TerminalNumber: parseInt(config.cardcomTerminalNumber),
    ApiName: config.cardcomApiName || '',
    Operation: 'ChargeOnly',
    Amount: amount,
    ProductName: `Payment - ${bldg?.name || 'Building'} Apt ${apt.apartmentNumber} (${month})`,
    Language: locale,
    ISOCoinId: 1, // ILS
    ReturnValue: JSON.stringify({ apartmentId, month, organizationId, locale }),
    SuccessRedirectUrl: successUrl,
    FailedRedirectUrl: failedUrl,
    WebHookUrl: `${successUrl.split('/').slice(0, 3).join('/')}/api/payments/cardcom-webhook`,
  };

  const res = await fetch('https://secure.cardcom.solutions/api/v11/LowProfile/Create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new AppError(502, `CardCom API error: ${res.status}`);

  const data = await res.json();
  if (!data.LowProfileId) {
    throw new AppError(502, `CardCom failed: ${data.Description || JSON.stringify(data)}`);
  }

  return { lowProfileId: data.LowProfileId };
}

export async function verifyCardcomPayment(lowProfileId: string, organizationId: string): Promise<{
  verified: boolean;
  transactionId: string;
  ccLast4: string;
  amount: number;
  returnValue: any;
}> {
  const config = await getOrgSettings(organizationId);

  const res = await fetch('https://secure.cardcom.solutions/api/v11/LowProfile/GetLpResult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      TerminalNumber: parseInt(config.cardcomTerminalNumber || '0'),
      ApiName: config.cardcomApiName || '',
      LowProfileId: lowProfileId,
    }),
  });

  if (!res.ok) throw new AppError(502, `CardCom verification error: ${res.status}`);

  const result = await res.json();

  if (String(result.ResponseCode) !== '0') {
    return { verified: false, transactionId: '', ccLast4: '', amount: 0, returnValue: null };
  }

  let returnValue = null;
  try { returnValue = JSON.parse(result.ReturnValue || '{}'); } catch {}

  return {
    verified: true,
    transactionId: result.InternalDealNumber?.toString() || result.TranzactionInfo?.InternalDealNumber?.toString() || lowProfileId,
    ccLast4: result.Last4CardDigits || result.CardInfo?.Last4CardDigits || '',
    amount: parseFloat(result.Amount || '0'),
    returnValue,
  };
}

export async function handleCardcomWebhook(body: any): Promise<void> {
  const lowProfileId = body.LowProfileId || body.InternalDealNumber?.toString() || body.TranzactionInfo?.InternalDealNumber?.toString() || '';
  const returnValueRaw = body.ReturnValue || '';

  if (!lowProfileId) return;

  let returnValue: any;
  try { returnValue = JSON.parse(returnValueRaw); } catch { return; }

  const { apartmentId, month, organizationId, locale } = returnValue || {};
  if (!apartmentId || !month || !organizationId) return;

  // Verify payment server-to-server
  const verification = await verifyCardcomPayment(lowProfileId, organizationId);
  if (!verification.verified) return;

  // Validate UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(apartmentId)) return;

  // Create payment
  const amount = verification.amount || parseFloat(body.Amount || body.Sum || '0');
  if (amount <= 0) return;

  await paymentService.createPayment({ apartmentId, month, amount }, 'system');

  // Auto-generate invoice
  try {
    const { createInvoice } = await import('./receipt.service.js');
    await createInvoice(apartmentId, month);
  } catch {}

  // Create EZCount invoice if configured
  try {
    const { createEZCountInvoice } = await import('./ezcount.service.js');
    await createEZCountInvoice(organizationId, {
      transactionId: verification.transactionId,
      description: `Payment - Apt ${apartmentId} (${month})`,
      amount,
      currency: 'ILS',
      ccLast4: verification.ccLast4,
    }, locale || 'he');
  } catch {}
}

// ============ PAYPAL ============

export async function createPaypalOrder(
  organizationId: string,
  apartmentId: string,
  amount: number,
  month: string,
  returnUrl: string,
  cancelUrl: string,
): Promise<{ orderId: string; approveUrl: string }> {
  const config = await getOrgSettings(organizationId);
  if (!config.paypalEnabled || !config.paypalClientId || !config.paypalClientSecret) {
    throw new AppError(400, 'PayPal is not configured');
  }

  const [apt] = await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
  if (!apt) throw new AppError(404, 'Apartment not found');

  const [bldg] = await db.select({ orgId: buildings.organizationId }).from(buildings).where(eq(buildings.id, apt.buildingId)).limit(1);
  if (bldg?.orgId !== organizationId) throw new AppError(403, 'Apartment does not belong to this organization');

  const [building] = await db.select({ name: buildings.name }).from(buildings).where(eq(buildings.id, apt.buildingId)).limit(1);

  const baseUrl = config.paypalMode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // Get access token
  const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const authData = await authRes.json() as any;
  if (!authData.access_token) throw new AppError(500, 'Failed to authenticate with PayPal');

  // Create order
  const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        description: `Payment - ${building?.name || 'Building'} Apt ${apt.apartmentNumber} (${month})`,
        amount: {
          currency_code: config.currencyCode,
          value: amount.toFixed(2),
        },
        custom_id: JSON.stringify({ apartmentId, month, organizationId }),
      }],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });
  const orderData = await orderRes.json() as any;

  const approveLink = orderData.links?.find((l: any) => l.rel === 'approve');
  if (!approveLink) throw new AppError(500, 'Failed to create PayPal order');

  return { orderId: orderData.id, approveUrl: approveLink.href };
}

export async function capturePaypalOrder(
  organizationId: string,
  orderId: string,
): Promise<void> {
  const config = await getOrgSettings(organizationId);
  if (!config.paypalClientId || !config.paypalClientSecret) {
    throw new AppError(400, 'PayPal is not configured');
  }

  const baseUrl = config.paypalMode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // Get access token
  const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const authData = await authRes.json() as any;

  // Capture order
  const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authData.access_token}`,
      'Content-Type': 'application/json',
    },
  });
  const captureData = await captureRes.json() as any;

  if (captureData.status === 'COMPLETED') {
    const customId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id;
    if (customId) {
      try {
        const { apartmentId, month } = JSON.parse(customId);
        const amount = parseFloat(captureData.purchase_units[0].payments.captures[0].amount.value);
        await paymentService.createPayment({ apartmentId, month, amount }, 'system');

        // Auto-generate invoice
        try {
          const { createInvoice } = await import('./receipt.service.js');
          await createInvoice(apartmentId, month);
        } catch {
          // Don't fail payment if invoice generation fails
        }
      } catch { /* ignore parse errors */ }
    }
  }
}
