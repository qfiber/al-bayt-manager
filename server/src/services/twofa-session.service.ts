import crypto from 'crypto';

interface TwoFASession {
  userId: string;
  factorId: string;
  attempts: number;
  createdAt: number;
}

const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

const sessions = new Map<string, TwoFASession>();

// Periodic cleanup every 60s
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 60_000);

/**
 * Create a 2FA session after successful password verification.
 * Returns an opaque session token the client must present at /login/2fa.
 */
export function createTwoFASession(userId: string, factorId: string): string {
  const sessionToken = crypto.randomBytes(32).toString('hex');

  sessions.set(sessionToken, {
    userId,
    factorId,
    attempts: 0,
    createdAt: Date.now(),
  });

  return sessionToken;
}

/**
 * Consume a 2FA session: validate it exists, is not expired, and increment attempts.
 * Returns { userId, factorId } on success, or throws a descriptive error string.
 */
export function consumeTwoFASession(sessionToken: string): { userId: string; factorId: string } {
  const session = sessions.get(sessionToken);

  if (!session) {
    return invalid('Invalid or expired 2FA session');
  }

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionToken);
    return invalid('2FA session expired');
  }

  if (session.attempts >= MAX_ATTEMPTS) {
    sessions.delete(sessionToken);
    return invalid('Too many 2FA attempts. Please log in again.');
  }

  session.attempts++;
  return { userId: session.userId, factorId: session.factorId };
}

/**
 * Invalidate a 2FA session after successful verification.
 */
export function invalidateTwoFASession(sessionToken: string): void {
  sessions.delete(sessionToken);
}

function invalid(message: string): never {
  throw new Error(message);
}
