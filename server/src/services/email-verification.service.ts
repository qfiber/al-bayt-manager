import crypto from 'crypto';

interface VerificationSession {
  userId: string;
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

const sessions = new Map<string, VerificationSession>();
const MAX_ATTEMPTS = 5;
const EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(key);
  }
}, 60 * 1000);

export function createVerificationSession(userId: string, email: string): { token: string; code: string } {
  const token = crypto.randomUUID();
  const code = String(crypto.randomInt(100000, 1000000)); // 6-digit code (cryptographically secure)
  sessions.set(token, {
    userId,
    email,
    code,
    expiresAt: Date.now() + EXPIRY_MS,
    attempts: 0,
  });
  return { token, code };
}

export function verifyCode(token: string, code: string): { userId: string; email: string } {
  const session = sessions.get(token);
  if (!session) throw new Error('Verification session expired or invalid');
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    throw new Error('Verification code expired');
  }
  session.attempts++;
  if (session.attempts > MAX_ATTEMPTS) {
    sessions.delete(token);
    throw new Error('Too many attempts');
  }
  if (session.code !== code) {
    throw new Error('Invalid verification code');
  }
  sessions.delete(token);
  return { userId: session.userId, email: session.email };
}

export function getSessionByToken(token: string): VerificationSession | undefined {
  return sessions.get(token);
}
