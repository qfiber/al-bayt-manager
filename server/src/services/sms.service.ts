import { db } from '../config/database.js';
import { settings, smsLogs } from '../db/schema/index.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { logger } from '../config/logger.js';
import { AppError } from '../middleware/error-handler.js';

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Send an SMS via 019 SMS provider.
 * API docs: https://docs.019sms.co.il/sms/
 *
 * Endpoint: POST https://019sms.co.il/api
 * Auth: Bearer token in Authorization header
 * Content-Type: application/json
 */
export async function sendSms(phone: string, message: string, meta?: { templateIdentifier?: string; userId?: string; languageUsed?: string }): Promise<SmsResult> {
  const [config] = await db.select().from(settings).limit(1);
  if (!config?.smsEnabled) {
    throw new AppError(400, 'SMS sending is not configured');
  }

  if (!config.smsApiToken || !config.smsUsername) {
    throw new AppError(400, 'SMS API token or username not configured');
  }

  // Normalize Israeli phone number: remove leading 0 or +972
  const normalizedPhone = normalizeIsraeliPhone(phone);
  if (!normalizedPhone) {
    throw new AppError(400, 'Invalid phone number format');
  }

  // Truncate message to 019 limit (1005 chars)
  const truncatedMessage = message.slice(0, 1005);

  const body = {
    sms: {
      user: {
        username: config.smsUsername,
      },
      source: config.smsSenderName || 'AlBayt',
      destinations: {
        phone: [{ id: '1', number: normalizedPhone }],
      },
      message: truncatedMessage,
    },
  };

  try {
    const res = await fetch('https://019sms.co.il/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.smsApiToken}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `HTTP ${res.status}`;
      logger.error({ status: res.status, body: data }, '019 SMS API error');
      logSmsAttempt(meta?.templateIdentifier, phone, meta?.userId, 'failed', errorMsg, truncatedMessage, meta?.languageUsed);
      return {
        success: false,
        error: errorMsg,
        statusCode: res.status,
      };
    }

    // 019 returns status 0 for success
    const status = data?.status ?? data?.sms?.status;
    if (status !== undefined && status !== 0 && status !== '0') {
      const errorMsg = `019 status code: ${status}`;
      logger.warn({ response: data }, '019 SMS non-zero status');
      logSmsAttempt(meta?.templateIdentifier, phone, meta?.userId, 'failed', errorMsg, truncatedMessage, meta?.languageUsed);
      return {
        success: false,
        error: errorMsg,
        statusCode: status,
      };
    }

    logger.info({ phone: normalizedPhone }, 'SMS sent successfully');
    logSmsAttempt(meta?.templateIdentifier, phone, meta?.userId, 'sent', undefined, truncatedMessage, meta?.languageUsed);
    return {
      success: true,
      messageId: data?.messageId || data?.sms?.id,
    };
  } catch (err: any) {
    logger.error(err, 'SMS send failed');
    logSmsAttempt(meta?.templateIdentifier, phone, meta?.userId, 'failed', err.message || 'Network error', truncatedMessage, meta?.languageUsed);
    return {
      success: false,
      error: err.message || 'Network error',
    };
  }
}

/**
 * Send a test SMS to verify configuration.
 */
export async function sendTestSms(phone: string): Promise<SmsResult> {
  return sendSms(phone, 'This is a test message from Al-Bayt Manager / رسالة تجريبية من البيت');
}

/**
 * Normalize Israeli phone numbers to format: 5xxxxxxxx (without leading 0 or country code).
 * Accepts: 05xxxxxxxx, +9725xxxxxxxx, 9725xxxxxxxx, 5xxxxxxxx
 */
function normalizeIsraeliPhone(phone: string): string | null {
  // Strip spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');

  let digits = cleaned;

  // Remove +972 prefix
  if (digits.startsWith('+972')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('972')) {
    digits = digits.slice(3);
  }

  // Remove leading 0
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Israeli mobile numbers start with 5 and are 9 digits
  if (/^5\d{8}$/.test(digits)) {
    return digits;
  }

  // Also allow landlines (2, 3, 4, 8, 9 prefixes, 8-9 digits)
  if (/^[23489]\d{7,8}$/.test(digits)) {
    return digits;
  }

  return null;
}

/**
 * Log an SMS send attempt to sms_logs table.
 */
function logSmsAttempt(
  templateIdentifier: string | undefined,
  recipientPhone: string,
  userId: string | undefined,
  status: string,
  failureReason?: string,
  messageSent?: string,
  languageUsed?: string,
) {
  db.insert(smsLogs).values({
    templateIdentifier,
    recipientPhone,
    userId,
    status,
    failureReason,
    messageSent,
    languageUsed,
  }).catch((err) => logger.error(err, 'SMS log error'));
}

/**
 * Query SMS delivery logs with optional filters.
 */
export async function listSmsLogs(filters?: {
  status?: string;
  templateIdentifier?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  const { limit = 100, offset = 0 } = filters || {};

  let query = db.select().from(smsLogs);

  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(smsLogs.status, filters.status));
  if (filters?.templateIdentifier) conditions.push(eq(smsLogs.templateIdentifier, filters.templateIdentifier));
  if (filters?.startDate) conditions.push(gte(smsLogs.createdAt, new Date(filters.startDate)));
  if (filters?.endDate) conditions.push(lte(smsLogs.createdAt, new Date(filters.endDate)));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query.orderBy(desc(smsLogs.createdAt)).limit(limit).offset(offset);
}
