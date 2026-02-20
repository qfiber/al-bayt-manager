import { env } from '../config/env.js';

export async function verifyTurnstile(token: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    return true; // Skip verification if no secret key configured
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  });

  const data = await response.json() as { success: boolean };
  return data.success;
}
