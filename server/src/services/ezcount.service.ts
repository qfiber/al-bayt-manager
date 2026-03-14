import { logger } from '../config/logger.js';
import { getRawSettings } from './settings.service.js';

const DOC_TYPE_INVOICE_RECEIPT = 320;
const PAYMENT_TYPE_CREDIT_CARD = 3;

interface CreateInvoiceParams {
  transactionId: string;
  customerName?: string;
  customerEmail?: string;
  description: string;
  amount: number;
  currency: string;
  ccLast4?: string;
}

interface EZCountResponse {
  success: boolean;
  pdf_link?: string;
  doc_number?: string;
  doc_uuid?: string;
  errNum?: number;
  errMsg?: string;
}

export async function createEZCountInvoice(organizationId: string, params: CreateInvoiceParams, locale: string = 'he'): Promise<EZCountResponse | null> {
  const config = await getRawSettings(organizationId);

  // EZCount credentials from settings
  const apiKey = (config as any)?.ezCountApiKey;
  const apiEmail = (config as any)?.ezCountApiEmail;

  if (!apiKey) {
    logger.info('EZCount not configured, skipping invoice');
    return null;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction ? 'https://api.ezcount.co.il' : 'https://demo.ezcount.co.il';

  const body = {
    api_key: apiKey,
    api_email: apiEmail || '',
    developer_email: apiEmail || '',
    type: DOC_TYPE_INVOICE_RECEIPT,
    transaction_id: params.transactionId,
    description: params.description,
    customer_name: params.customerName || 'Tenant',
    customer_email: params.customerEmail || '',
    lang: locale,
    main_currency_iso: params.currency,
    tax_authority: { is_skip_fallback: true },
    item: [{
      details: params.description,
      amount: 1,
      price: params.amount,
      vat_type: 'INC',
    }],
    payment: [{
      payment_type: PAYMENT_TYPE_CREDIT_CARD,
      payment_sum: params.amount,
      cc_number: params.ccLast4 || '0000',
      cc_type_name: 'Credit Card',
      cc_deal_type: 1,
      cc_num_of_payments: 1,
    }],
    price_total: params.amount,
    auto_balance: true,
    show_items_including_vat: true,
    dont_send_email: 0,
  };

  try {
    const res = await fetch(`${baseUrl}/api/createDoc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`EZCount API error: ${res.status}`);

    const data: EZCountResponse = await res.json();
    if (!data.success) {
      throw new Error(`EZCount failed: ${data.errMsg || 'Unknown'} (code ${data.errNum})`);
    }

    logger.info({ docNumber: data.doc_number, pdfLink: data.pdf_link }, 'EZCount invoice created');
    return data;
  } catch (err) {
    logger.error(err, 'EZCount invoice creation failed');
    return null;
  }
}
