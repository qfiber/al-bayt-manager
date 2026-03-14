import crypto from 'crypto';

interface ResetSession {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

const sessions = new Map<string, ResetSession>();
const MAX_ATTEMPTS = 5;
const EXPIRY_MS = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(key);
  }
}, 60 * 1000);

export function createResetSession(email: string): { token: string; code: string } {
  const token = crypto.randomUUID();
  const code = String(crypto.randomInt(100000, 1000000));
  sessions.set(token, { email, code, expiresAt: Date.now() + EXPIRY_MS, attempts: 0 });
  return { token, code };
}

export function verifyResetCode(token: string, code: string): { email: string } {
  const session = sessions.get(token);
  if (!session) throw new Error('Reset session expired or invalid');
  if (session.expiresAt < Date.now()) { sessions.delete(token); throw new Error('Reset code expired'); }
  session.attempts++;
  if (session.attempts > MAX_ATTEMPTS) { sessions.delete(token); throw new Error('Too many attempts'); }
  if (session.code !== code) throw new Error('Invalid reset code');
  sessions.delete(token);
  return { email: session.email };
}
