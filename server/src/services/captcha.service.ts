import { db } from '../config/database.js';
import { settings } from '../db/schema/index.js';

export async function verifyTurnstile(token: string): Promise<boolean> {
  const [row] = await db.select({ turnstileSecretKey: settings.turnstileSecretKey }).from(settings).limit(1);
  const secretKey = row?.turnstileSecretKey;

  if (!secretKey) {
    return true; // Skip verification if no secret key configured
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: secretKey,
      response: token,
    }),
  });

  const data = await response.json() as { success: boolean };
  return data.success;
}
