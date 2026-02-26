import crypto from 'crypto';

interface EmailChangeSession {
  userId: string;
  newEmail: string;
  otpHash: string;
  attempts: number;
  createdAt: number;
}

const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

const sessions = new Map<string, EmailChangeSession>();

// Periodic cleanup every 60s
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 60_000);

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function createEmailChangeSession(userId: string, newEmail: string, otp: string): string {
  const sessionToken = crypto.randomBytes(32).toString('hex');

  sessions.set(sessionToken, {
    userId,
    newEmail,
    otpHash: hashOtp(otp),
    attempts: 0,
    createdAt: Date.now(),
  });

  return sessionToken;
}

export function consumeEmailChangeSession(sessionToken: string, otp: string): { userId: string; newEmail: string } {
  const session = sessions.get(sessionToken);

  if (!session) {
    throw new Error('Invalid or expired email change session');
  }

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionToken);
    throw new Error('Email change session expired');
  }

  if (session.attempts >= MAX_ATTEMPTS) {
    sessions.delete(sessionToken);
    throw new Error('Too many OTP attempts. Please start over.');
  }

  session.attempts++;

  if (hashOtp(otp) !== session.otpHash) {
    throw new Error('Invalid OTP code');
  }

  // Valid — remove session so it can't be reused
  sessions.delete(sessionToken);
  return { userId: session.userId, newEmail: session.newEmail };
}

export function invalidateEmailChangeSession(sessionToken: string): void {
  sessions.delete(sessionToken);
}
