import { db } from '../config/database.js';
import { accountLockouts } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { logSecurityEvent } from './security-alert.service.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function checkAccountLockout(email: string): Promise<{ locked: boolean; lockedUntil?: Date }> {
  const [record] = await db
    .select()
    .from(accountLockouts)
    .where(eq(accountLockouts.email, email.toLowerCase()))
    .limit(1);

  if (!record) return { locked: false };

  if (record.lockedUntil && record.lockedUntil > new Date()) {
    return { locked: true, lockedUntil: record.lockedUntil };
  }

  // Lockout expired — reset if it was locked
  if (record.lockedUntil) {
    await db
      .update(accountLockouts)
      .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(accountLockouts.email, email.toLowerCase()));
  }

  return { locked: false };
}

export async function recordFailedLogin(email: string, ipAddress?: string, userAgent?: string): Promise<{ locked: boolean }> {
  const normalizedEmail = email.toLowerCase();
  const now = new Date();

  const [existing] = await db
    .select()
    .from(accountLockouts)
    .where(eq(accountLockouts.email, normalizedEmail))
    .limit(1);

  let failedAttempts: number;

  if (existing) {
    // If lockout expired, reset counter
    const currentAttempts = (existing.lockedUntil && existing.lockedUntil <= now)
      ? 1
      : existing.failedAttempts + 1;

    failedAttempts = currentAttempts;

    const updates: Record<string, any> = {
      failedAttempts: currentAttempts,
      lastFailedAt: now,
      updatedAt: now,
    };

    if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
      updates.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
    }

    await db
      .update(accountLockouts)
      .set(updates)
      .where(eq(accountLockouts.email, normalizedEmail));
  } else {
    failedAttempts = 1;

    await db.insert(accountLockouts).values({
      email: normalizedEmail,
      failedAttempts: 1,
      lastFailedAt: now,
    });
  }

  // Log failed login security event
  logSecurityEvent({
    eventType: 'failed_login',
    email: normalizedEmail,
    ipAddress,
    userAgent,
    details: { failedAttempts },
  });

  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    // Log account locked security event
    logSecurityEvent({
      eventType: 'account_locked',
      email: normalizedEmail,
      ipAddress,
      userAgent,
      details: { failedAttempts, lockoutMinutes: LOCKOUT_DURATION_MS / 60000 },
    });
    return { locked: true };
  }

  return { locked: false };
}

export async function clearFailedAttempts(email: string): Promise<void> {
  await db
    .update(accountLockouts)
    .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(accountLockouts.email, email.toLowerCase()));
}
