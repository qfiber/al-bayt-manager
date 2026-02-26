import { db } from '../config/database.js';
import { settings } from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';

type SettingsRow = typeof settings.$inferSelect;

/** Rewrite legacy /api/uploads/logos/X URLs to /public-uploads/logos/X */
function normalizeLogoUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^\/api\/uploads\/logos\//, '/public-uploads/logos/');
}

/** Get or create the singleton settings row */
async function getOrCreateSettings(): Promise<SettingsRow> {
  const [existing] = await db.select().from(settings).limit(1);
  if (existing) return existing;

  // Upsert to avoid race conditions on first access
  const [created] = await db
    .insert(settings)
    .values({})
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Another request won the race — just read it
  const [row] = await db.select().from(settings).limit(1);
  return row;
}

function maskSensitiveFields(row: SettingsRow): Record<string, unknown> {
  const masked: Record<string, unknown> = { ...row };
  masked.logoUrl = normalizeLogoUrl(row.logoUrl);
  for (const field of ['resendApiKey', 'turnstileSecretKey'] as const) {
    const val = row[field];
    if (val) {
      masked[field] = val.length > 8
        ? `${'*'.repeat(val.length - 4)}${val.slice(-4)}`
        : '********';
    }
  }
  return masked;
}

export async function getSettings() {
  const row = await getOrCreateSettings();
  return maskSensitiveFields(row);
}

export async function getPublicSettings() {
  const [result] = await db.select({
    companyName: settings.companyName,
    systemLanguage: settings.systemLanguage,
    logoUrl: settings.logoUrl,
    turnstileEnabled: settings.turnstileEnabled,
    turnstileSiteKey: settings.turnstileSiteKey,
    currencyCode: settings.currencyCode,
    currencySymbol: settings.currencySymbol,
  }).from(settings).limit(1);
  if (!result) {
    return {
      companyName: null,
      systemLanguage: 'ar',
      logoUrl: null,
      turnstileEnabled: false,
      turnstileSiteKey: null,
      currencyCode: 'ILS',
      currencySymbol: '₪',
    };
  }
  return { ...result, logoUrl: normalizeLogoUrl(result.logoUrl) };
}

export async function updateSettings(data: Partial<{
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
  ntfyEnabled: boolean;
  ntfyServerUrl: string | null;
  currencyCode: string;
  currencySymbol: string;
}>) {
  const existing = await getOrCreateSettings();

  const updateData = { ...data };

  // Don't overwrite secrets with their masked representations
  if (updateData.resendApiKey && /^\*+$/.test(updateData.resendApiKey)) {
    delete updateData.resendApiKey;
  }
  if (updateData.turnstileSecretKey && /^\*+$/.test(updateData.turnstileSecretKey)) {
    delete updateData.turnstileSecretKey;
  }

  const [result] = await db
    .update(settings)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(settings.id, existing.id))
    .returning();
  return maskSensitiveFields(result);
}

/** Internal: get raw settings without masking (for email service, etc.) */
export async function getRawSettings() {
  return getOrCreateSettings();
}
