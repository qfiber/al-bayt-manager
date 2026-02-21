import { db } from '../config/database.js';
import { settings } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export async function getSettings() {
  const [result] = await db.select().from(settings).limit(1);
  if (!result) {
    // Create default settings
    const [created] = await db.insert(settings).values({}).returning();
    return maskSensitiveFields(created);
  }
  return maskSensitiveFields(result);
}

function maskSensitiveFields(settings: any) {
  const masked = { ...settings };
  if (masked.resendApiKey) {
    const key = masked.resendApiKey;
    masked.resendApiKey = key.length > 8 ? `${'*'.repeat(key.length - 4)}${key.slice(-4)}` : '********';
  }
  if (masked.turnstileSecretKey) {
    const key = masked.turnstileSecretKey;
    masked.turnstileSecretKey = key.length > 8 ? `${'*'.repeat(key.length - 4)}${key.slice(-4)}` : '********';
  }
  return masked;
}

export async function updateSettings(data: Partial<{
  systemLanguage: string;
  logoUrl: string | null;
  smtpEnabled: boolean;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  resendApiKey: string | null;
  turnstileEnabled: boolean;
  turnstileSiteKey: string | null;
  turnstileSecretKey: string | null;
}>) {
  const existing = await getRawSettings();
  // Skip updating masked values
  const updateData = { ...data };
  if (updateData.resendApiKey && /^\*+/.test(updateData.resendApiKey)) {
    delete updateData.resendApiKey;
  }
  if (updateData.turnstileSecretKey && /^\*+/.test(updateData.turnstileSecretKey)) {
    delete updateData.turnstileSecretKey;
  }
  const [result] = await db
    .update(settings)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(settings.id, existing.id))
    .returning();
  return maskSensitiveFields(result);
}

/** Internal: get raw settings without masking (for ID lookups, email service, etc.) */
async function getRawSettings() {
  const [result] = await db.select().from(settings).limit(1);
  if (!result) {
    const [created] = await db.insert(settings).values({}).returning();
    return created;
  }
  return result;
}
