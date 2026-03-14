import { getRawSettings } from './settings.service.js';

export async function verifyTurnstile(token: string): Promise<boolean> {
  const config = await getRawSettings();
  const secretKey = config?.turnstileSecretKey;

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
