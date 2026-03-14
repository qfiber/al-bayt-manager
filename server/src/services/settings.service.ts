import { db } from '../config/database.js';
import { settings } from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption.js';

const SENSITIVE_FIELDS = [
  'resendApiKey', 'turnstileSecretKey', 'smsApiToken',
  'stripeSecretKey', 'stripeWebhookSecret',
  'cardcomApiPassword',
  'paypalClientSecret',
  'twilioAuthToken',
  'ezCountApiKey',
  'hypPassP',
  'hypKey',
] as const;

type SettingsRow = typeof settings.$inferSelect;

/** Rewrite legacy /api/uploads/logos/X URLs to /public-uploads/logos/X */
function normalizeLogoUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^\/api\/uploads\/logos\//, '/public-uploads/logos/');
}

/** Get or create the settings row, optionally scoped by organization */
async function getOrCreateSettings(organizationId?: string): Promise<SettingsRow> {
  const baseQuery = db.select().from(settings);
  const [existing] = organizationId
    ? await baseQuery.where(eq(settings.organizationId, organizationId)).limit(1)
    : await baseQuery.limit(1);
  if (existing) return existing;

  // Upsert to avoid race conditions on first access
  const [created] = await db
    .insert(settings)
    .values(organizationId ? { organizationId } : {})
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Another request won the race — just read it
  const retryQuery = db.select().from(settings);
  const [row] = organizationId
    ? await retryQuery.where(eq(settings.organizationId, organizationId)).limit(1)
    : await retryQuery.limit(1);
  return row;
}

function maskSensitiveFields(row: SettingsRow): Record<string, unknown> {
  const masked: Record<string, unknown> = { ...row };
  masked.logoUrl = normalizeLogoUrl(row.logoUrl);
  for (const field of SENSITIVE_FIELDS) {
    const val = (row as any)[field];
    if (val) {
      // Decrypt first to get real value for masking
      const plain = decrypt(val as string);
      masked[field] = plain.length > 8
        ? `${'*'.repeat(plain.length - 4)}${plain.slice(-4)}`
        : '********';
    }
  }
  return masked;
}

export async function getSettings(organizationId?: string) {
  const row = await getOrCreateSettings(organizationId);
  return maskSensitiveFields(row);
}

export async function getPublicSettings(organizationId?: string) {
  const baseQuery = db.select({
    companyName: settings.companyName,
    systemLanguage: settings.systemLanguage,
    logoUrl: settings.logoUrl,
    turnstileEnabled: settings.turnstileEnabled,
    turnstileSiteKey: settings.turnstileSiteKey,
    registrationEnabled: settings.registrationEnabled,
    currencyCode: settings.currencyCode,
    currencySymbol: settings.currencySymbol,
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
  }).from(settings);
  const [result] = organizationId
    ? await baseQuery.where(eq(settings.organizationId, organizationId)).limit(1)
    : await baseQuery.limit(1);
  if (!result) {
    return {
      companyName: null,
      systemLanguage: 'ar',
      logoUrl: null,
      turnstileEnabled: false,
      turnstileSiteKey: null,
      registrationEnabled: true,
      currencyCode: 'ILS',
      currencySymbol: '₪',
    };
  }
  return { ...result, logoUrl: normalizeLogoUrl(result.logoUrl) };
}

export async function updateSettings(organizationId: string | undefined, data: Partial<{
  companyName: string | null;
  systemLanguage: string;
  logoUrl: string | null;
  smtpEnabled: boolean;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  resendApiKey: string | null;
  turnstileEnabled: boolean;
  turnstileSiteKey: string | null;
  turnstileSecretKey: string | null;
  registrationEnabled: boolean;
  ntfyEnabled: boolean;
  ntfyServerUrl: string | null;
  smsEnabled: boolean;
  smsProvider: string | null;
  smsApiToken: string | null;
  smsUsername: string | null;
  smsSenderName: string | null;
  currencyCode: string;
  currencySymbol: string;
}>) {
  const existing = await getOrCreateSettings(organizationId);

  const updateData: Record<string, unknown> = { ...data };

  // Don't overwrite secrets with their masked representations, and encrypt new values
  for (const field of SENSITIVE_FIELDS) {
    const val = updateData[field];
    if (typeof val === 'string' && /\*{4,}/.test(val)) {
      // Value contains masked content — don't overwrite the stored value
      delete updateData[field];
    } else if (typeof val === 'string' && val.length > 0 && !isEncrypted(val)) {
      // New plaintext value — encrypt before saving
      updateData[field] = encrypt(val);
    }
  }

  const [result] = await db
    .update(settings)
    .set({ ...updateData, updatedAt: new Date() } as any)
    .where(eq(settings.id, existing.id))
    .returning();
  return maskSensitiveFields(result);
}

/** Internal: get raw settings without masking (for email service, etc.) */
export async function getRawSettings(organizationId?: string) {
  const row = await getOrCreateSettings(organizationId);
  // Decrypt sensitive fields for internal use
  const decrypted = { ...row } as any;
  for (const field of SENSITIVE_FIELDS) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      decrypted[field] = decrypt(decrypted[field]);
    }
  }
  return decrypted as SettingsRow;
}
