import { logger } from '../config/logger.js';
import { getRawSettings } from './settings.service.js';
import { AppError } from '../middleware/error-handler.js';

const HYP_BASE_URL = 'https://pay.hyp.co.il/p/';
const HYP_TEST_MASOF = '0010131918';

interface HypConfig {
  masof: string;
  key: string;
  passP: string;
}

async function getHypConfig(organizationId?: string): Promise<HypConfig> {
  // Try org-specific settings first
  if (organizationId) {
    const orgConfig = await getRawSettings(organizationId);
    if (orgConfig?.hypEnabled && orgConfig.hypKey && orgConfig.hypPassP) {
      return {
        masof: orgConfig.hypMasof || HYP_TEST_MASOF,
        key: orgConfig.hypKey,
        passP: orgConfig.hypPassP,
      };
    }
  }

  // Fall back: search ALL settings rows for one with HYP configured
  const { db: database } = await import('../config/database.js');
  const { settings: settingsTable } = await import('../db/schema/index.js');
  const { eq } = await import('drizzle-orm');

  const allSettings = await database.select().from(settingsTable).where(eq(settingsTable.hypEnabled, true)).limit(1);
  if (allSettings.length > 0) {
    const config = allSettings[0];
    // Decrypt sensitive fields
    const { decrypt } = await import('../utils/encryption.js');
    const key = config.hypKey ? decrypt(config.hypKey) : '';
    const passP = config.hypPassP ? decrypt(config.hypPassP) : '';

    if (key && passP) {
      return {
        masof: config.hypMasof || HYP_TEST_MASOF,
        key,
        passP,
      };
    }
  }

  throw new AppError(400, 'HYP is not configured. Enable HYP and enter credentials in Settings.');
}

/**
 * Step 1: Generate API signature for a payment
 */
export async function generateSignature(
  organizationId: string,
  params: {
    amount: number;
    order: string;
    currency?: number; // 1=ILS, 2=USD, 3=EUR
    maxInstallments?: number;
  },
): Promise<string> {
  const hyp = await getHypConfig(organizationId);

  const queryParams = new URLSearchParams({
    action: 'APISign',
    What: 'SIGN',
    Masof: hyp.masof,
    KEY: hyp.key,
    PassP: hyp.passP,
    Amount: params.amount.toFixed(2),
    Order: params.order,
    Coin: String(params.currency || 1),
    Tash: String(params.maxInstallments || 1),
    UTF8: 'True',
    UTF8out: 'True',
  });

  const url = `${HYP_BASE_URL}?${queryParams.toString()}`;
  logger.info({ masof: hyp.masof, amount: params.amount, order: params.order }, 'HYP APISign request');

  const res = await fetch(url);
  const text = await res.text();

  logger.info({ status: res.status, responseLength: text.length, responsePreview: text.substring(0, 500) }, 'HYP APISign response');

  // HYP may return query string format, JSON, or HTML
  let signature = '';
  let ccode = '';

  // Try query string format first
  const responseParams = new URLSearchParams(text);
  signature = responseParams.get('Sign') || responseParams.get('sign') || '';
  ccode = responseParams.get('CCode') || responseParams.get('ccode') || '';

  // Try JSON format
  if (!signature) {
    try {
      const json = JSON.parse(text);
      signature = json.Sign || json.sign || '';
      ccode = String(json.CCode ?? json.ccode ?? '');
    } catch {}
  }

  if (!signature) {
    logger.error({ response: text, ccode, httpStatus: res.status }, 'HYP APISign failed');
    throw new AppError(502, `HYP signature generation failed: CCode=${ccode}. Response: ${text.substring(0, 200)}`);
  }

  return signature;
}

/**
 * Step 2: Build the payment URL with signature
 */
export async function createPaymentUrl(
  organizationId: string,
  params: {
    amount: number;
    order: string;
    description: string;
    successUrl: string;
    errorUrl: string;
    currency?: number;
    maxInstallments?: number;
    locale?: string;
    // EZCount invoice params
    sendInvoice?: boolean;
    invoiceDescription?: string;
    customerName?: string;
    customerEmail?: string;
  },
): Promise<{ url: string; signature: string }> {
  const hyp = await getHypConfig(organizationId);

  // Step 1: Get signature
  const signature = await generateSignature(organizationId, {
    amount: params.amount,
    order: params.order,
    currency: params.currency,
    maxInstallments: params.maxInstallments,
  });

  // Step 2: Build payment URL
  const queryParams = new URLSearchParams({
    action: 'pay',
    Masof: hyp.masof,
    KEY: hyp.key,
    PassP: hyp.passP,
    Amount: params.amount.toFixed(2),
    Order: params.order,
    Sign: signature,
    Coin: String(params.currency || 1),
    Tash: String(params.maxInstallments || 1),
    UTF8: 'True',
    UTF8out: 'True',
    SuccessUrl: params.successUrl,
    ErrorUrl: params.errorUrl,
    Info: params.description,
    PageLang: params.locale === 'he' ? 'HEB' : 'ENG',
  });

  // EZCount invoice auto-generation
  if (params.sendInvoice !== false) {
    queryParams.set('SendHesh', 'True');
    queryParams.set('Pritim', 'True');
    queryParams.set('heshDesc', `[0~${params.invoiceDescription || params.description}~1~${params.amount.toFixed(2)}]`);
    queryParams.set('EZ.lang', params.locale === 'he' ? 'he' : 'en');
    if (params.customerName) queryParams.set('ClientName', params.customerName);
    if (params.customerEmail) queryParams.set('ClientLName', params.customerEmail);
    if (params.customerEmail) queryParams.set('email', params.customerEmail);
  }

  const url = `${HYP_BASE_URL}?${queryParams.toString()}`;
  return { url, signature };
}

/**
 * Step 3: Verify payment response signature
 */
export async function verifyPaymentResponse(
  organizationId: string,
  params: {
    id: string;
    ccode: string;
    amount: string;
    acode: string;
    order: string;
    sign: string;
  },
): Promise<boolean> {
  const hyp = await getHypConfig(organizationId);

  const queryParams = new URLSearchParams({
    action: 'APISign',
    What: 'VERIFY',
    Masof: hyp.masof,
    KEY: hyp.key,
    PassP: hyp.passP,
    Id: params.id,
    CCode: params.ccode,
    Amount: params.amount,
    ACode: params.acode,
    Order: params.order,
    Sign: params.sign,
  });

  const res = await fetch(`${HYP_BASE_URL}?${queryParams.toString()}`);
  const text = await res.text();

  const responseParams = new URLSearchParams(text);
  const ccode = responseParams.get('CCode') || '';

  return ccode === '0';
}

/**
 * Create recurring payment via HK module
 */
export async function createRecurringPayment(
  organizationId: string,
  params: {
    amount: number;
    order: string;
    description: string;
    successUrl: string;
    errorUrl: string;
    currency?: number;
    installmentCount: number; // How many recurring charges
    frequencyMonths?: number; // Charge every N months (default 1)
    firstDate?: string; // YYYY-MM-DD
    locale?: string;
    customerName?: string;
    customerEmail?: string;
  },
): Promise<{ url: string; signature: string }> {
  const hyp = await getHypConfig(organizationId);

  const signature = await generateSignature(organizationId, {
    amount: params.amount,
    order: params.order,
    currency: params.currency,
  });

  const queryParams = new URLSearchParams({
    action: 'pay',
    Masof: hyp.masof,
    KEY: hyp.key,
    PassP: hyp.passP,
    Amount: params.amount.toFixed(2),
    Order: params.order,
    Sign: signature,
    Coin: String(params.currency || 1),
    UTF8: 'True',
    UTF8out: 'True',
    SuccessUrl: params.successUrl,
    ErrorUrl: params.errorUrl,
    Info: params.description,
    PageLang: params.locale === 'he' ? 'HEB' : 'ENG',
    // Recurring payment params
    HK: 'True',
    Tash: String(params.installmentCount),
    freq: String(params.frequencyMonths || 1),
    OnlyOnApprove: 'True',
  });

  if (params.firstDate) queryParams.set('FirstDate', params.firstDate);

  // EZCount auto-invoice for each charge
  queryParams.set('SendHesh', 'True');
  queryParams.set('Pritim', 'True');
  queryParams.set('heshDesc', `[0~${params.description}~1~${params.amount.toFixed(2)}]`);
  queryParams.set('EZ.lang', params.locale === 'he' ? 'he' : 'en');
  if (params.customerName) queryParams.set('ClientName', params.customerName);
  if (params.customerEmail) queryParams.set('email', params.customerEmail);

  const url = `${HYP_BASE_URL}?${queryParams.toString()}`;
  return { url, signature };
}

/**
 * Get/print invoice for a completed transaction
 */
export async function getInvoiceUrl(
  organizationId: string,
  transactionId: string,
): Promise<string> {
  const hyp = await getHypConfig(organizationId);

  // Generate signature for invoice retrieval
  const signParams = new URLSearchParams({
    action: 'APISign',
    What: 'SIGN',
    Masof: hyp.masof,
    KEY: hyp.key,
    PassP: hyp.passP,
    TransId: transactionId,
  });

  const signRes = await fetch(`${HYP_BASE_URL}?${signParams.toString()}`);
  const signText = await signRes.text();
  const signResponse = new URLSearchParams(signText);
  const signature = signResponse.get('Sign') || '';

  // Build print URL
  const printParams = new URLSearchParams({
    action: 'PrintHesh',
    Masof: hyp.masof,
    TransId: transactionId,
    type: 'EZCOUNT',
    signature,
  });

  return `${HYP_BASE_URL}?${printParams.toString()}`;
}
