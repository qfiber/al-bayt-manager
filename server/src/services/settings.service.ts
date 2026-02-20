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
  return masked;
}

export async function updateSettings(data: Partial<{
  monthlyFee: string;
  systemLanguage: string;
  logoUrl: string;
  smtpEnabled: boolean;
  smtpFromEmail: string;
  smtpFromName: string;
  resendApiKey: string;
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
}>) {
  const existing = await getSettings();
  const [result] = await db
    .update(settings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(settings.id, existing.id))
    .returning();
  return result;
}
