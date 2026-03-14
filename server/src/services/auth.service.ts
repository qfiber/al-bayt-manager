import crypto from 'crypto';
import { db } from '../config/database.js';
import { users, profiles, userRoles, refreshTokens, totpFactors, organizationMembers, organizations, settings } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { hashPassword, comparePassword } from '../utils/bcrypt.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { generateTotpSecret, verifyTotpCode, getTotpUri, generateQrCode } from '../utils/totp.js';
import { AppError } from '../middleware/error-handler.js';
import { env } from '../config/env.js';
import { createTwoFASession, consumeTwoFASession, invalidateTwoFASession } from './twofa-session.service.js';
import { deleteFile, getAvatarPath } from './storage.service.js';
import { createVerificationSession } from './email-verification.service.js';
import * as organizationService from './organization.service.js';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseExpiry(expiry: string): Date {
  const match = expiry.match(/^(\d+)([mhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);
  const [, num, unit] = match;
  const ms = { m: 60000, h: 3600000, d: 86400000 }[unit]!;
  return new Date(Date.now() + parseInt(num) * ms);
}

async function createRefreshToken(userId: string): Promise<string> {
  const token = signRefreshToken({ userId });
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: parseExpiry(env.JWT_REFRESH_EXPIRY),
  });
  return token;
}

async function getUserRole(userId: string): Promise<string> {
  const [role] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .limit(1);
  return role?.role || 'user';
}

async function getUserOrgMembership(userId: string): Promise<{ organizationId: string; role: string } | null> {
  const [membership] = await db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return membership || null;
}

async function getIsSuperAdmin(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.isSuperAdmin || false;
}

async function buildTokenPayload(userId: string, email: string) {
  const isSuperAdmin = await getIsSuperAdmin(userId);
  const orgMembership = await getUserOrgMembership(userId);
  // Fall back to legacy role if no org membership yet (migration period)
  const role = orgMembership?.role || await getUserRole(userId);
  return {
    userId,
    email,
    role,
    organizationId: orgMembership?.organizationId,
    isSuperAdmin,
  };
}

export async function signIn(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new AppError(401, 'Invalid credentials');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  // Check for verified TOTP factor
  const [factor] = await db
    .select()
    .from(totpFactors)
    .where(and(eq(totpFactors.userId, user.id), eq(totpFactors.status, 'verified')))
    .limit(1);

  if (factor) {
    // Return opaque session token instead of raw userId/factorId
    const sessionToken = createTwoFASession(user.id, factor.id);
    return { requires2FA: true, sessionToken };
  }

  const payload = await buildTokenPayload(user.id, user.email);
  const accessToken = signAccessToken(payload);
  const refreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken, requires2FA: false };
}

export async function verifyTotpLogin(sessionToken: string, code: string) {
  // Validate and consume 2FA session (handles expiry + attempt limits)
  let userId: string;
  let factorId: string;
  try {
    ({ userId, factorId } = consumeTwoFASession(sessionToken));
  } catch (err: any) {
    throw new AppError(400, err.message);
  }

  const [factor] = await db
    .select()
    .from(totpFactors)
    .where(and(eq(totpFactors.id, factorId), eq(totpFactors.userId, userId), eq(totpFactors.status, 'verified')))
    .limit(1);

  if (!factor) throw new AppError(400, 'Invalid factor');

  const valid = verifyTotpCode(factor.secret, code);
  if (!valid) throw new AppError(400, 'Invalid TOTP code');

  // Success — invalidate the session so it can't be reused
  invalidateTwoFASession(sessionToken);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(404, 'User not found');

  const payload = await buildTokenPayload(user.id, user.email);
  const accessToken = signAccessToken(payload);
  const refreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken, userId };
}

export async function signUp(email: string, password: string, name: string, phone?: string, organizationName?: string) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new AppError(409, 'Email already registered');

  const passwordHash = await hashPassword(password);

  const user = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, passwordHash })
      .returning();

    await tx.insert(profiles).values({
      id: user.id,
      name,
      phone,
    });

    if (organizationName) {
      // Create a new organization
      const [org] = await tx.insert(organizations).values({ name: organizationName }).returning();

      // Create default settings for the org
      await tx.insert(settings).values({
        organizationId: org.id,
        companyName: organizationName,
      });

      // Add user as org_admin
      await tx.insert(organizationMembers).values({
        userId: user.id,
        organizationId: org.id,
        role: 'org_admin',
      });

      // Legacy role table
      await tx.insert(userRoles).values({
        userId: user.id,
        role: 'admin',
      });
    } else {
      await tx.insert(userRoles).values({
        userId: user.id,
        role: 'user',
      });
    }

    return user;
  });

  // Check if email verification is needed
  const [config] = await db.select().from(settings).limit(1);
  if (config?.emailVerificationEnabled && config?.resendApiKey) {
    const { token, code } = createVerificationSession(user.id, email);
    // Send verification email
    try {
      const { sendVerificationEmail } = await import('./email.service.js');
      await sendVerificationEmail(email, code);
    } catch {
      // Don't fail registration if email send fails
    }
    return { id: user.id, email: user.email, requiresVerification: true, verificationToken: token };
  }

  return { id: user.id, email: user.email, requiresVerification: false };
}

export async function refreshTokensService(token: string) {
  let payload: { userId: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, 'Invalid refresh token');
  }

  const tokenHash = hashToken(token);
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, tokenHash), eq(refreshTokens.revoked, false)))
    .limit(1);

  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError(401, 'Refresh token expired or revoked');
  }

  // Revoke old token
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, stored.id));

  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user) throw new AppError(401, 'User not found');

  const tokenPayload = await buildTokenPayload(user.id, user.email);
  const accessToken = signAccessToken(tokenPayload);
  const newRefreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function signOut(token: string) {
  const tokenHash = hashToken(token);
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function getMe(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(404, 'User not found');

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);

  const orgMembership = await getUserOrgMembership(userId);
  const role = orgMembership?.role || await getUserRole(userId);

  let organizationName: string | null = null;
  if (orgMembership?.organizationId) {
    const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgMembership.organizationId)).limit(1);
    organizationName = org?.name || null;
  }

  const factors = await db
    .select({ id: totpFactors.id, status: totpFactors.status, friendlyName: totpFactors.friendlyName })
    .from(totpFactors)
    .where(eq(totpFactors.userId, userId));

  return {
    id: user.id,
    email: user.email,
    name: profile?.name,
    phone: profile?.phone,
    preferredLanguage: profile?.preferredLanguage,
    avatarUrl: profile?.avatarUrl,
    emailNotificationsEnabled: profile?.emailNotificationsEnabled ?? true,
    smsNotificationsEnabled: profile?.smsNotificationsEnabled ?? true,
    role,
    isSuperAdmin: user.isSuperAdmin,
    organizationId: orgMembership?.organizationId || null,
    organizationName,
    totpFactors: factors,
  };
}

export async function enrollTotp(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(404, 'User not found');

  const secret = generateTotpSecret();
  const uri = getTotpUri(secret, user.email);
  const qrCode = await generateQrCode(uri);

  const [factor] = await db
    .insert(totpFactors)
    .values({ userId, secret, friendlyName: 'Authenticator' })
    .returning();

  return { factorId: factor.id, qrCode, secret, uri };
}

export async function verifyTotpEnrollment(userId: string, factorId: string, code: string) {
  const [factor] = await db
    .select()
    .from(totpFactors)
    .where(and(eq(totpFactors.id, factorId), eq(totpFactors.userId, userId)))
    .limit(1);

  if (!factor) throw new AppError(404, 'Factor not found');

  const valid = verifyTotpCode(factor.secret, code);
  if (!valid) throw new AppError(400, 'Invalid TOTP code');

  await db.update(totpFactors).set({ status: 'verified' }).where(eq(totpFactors.id, factorId));

  return { success: true };
}

export async function unenrollTotp(userId: string, factorId: string, code: string) {
  const [factor] = await db
    .select()
    .from(totpFactors)
    .where(and(eq(totpFactors.id, factorId), eq(totpFactors.userId, userId), eq(totpFactors.status, 'verified')))
    .limit(1);

  if (!factor) throw new AppError(404, 'Factor not found');

  const valid = verifyTotpCode(factor.secret, code);
  if (!valid) throw new AppError(400, 'Invalid TOTP code');

  await db.delete(totpFactors).where(eq(totpFactors.id, factorId));

  return { success: true };
}

export async function getFactors(userId: string) {
  return db
    .select({
      id: totpFactors.id,
      friendlyName: totpFactors.friendlyName,
      status: totpFactors.status,
      createdAt: totpFactors.createdAt,
    })
    .from(totpFactors)
    .where(eq(totpFactors.userId, userId));
}

/**
 * Self-service: update profile (phone, preferredLanguage, avatarUrl)
 */
export async function updateProfile(userId: string, data: { name?: string; phone?: string; preferredLanguage?: string; avatarUrl?: string; emailNotificationsEnabled?: boolean; smsNotificationsEnabled?: boolean }) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);

  // If replacing avatar, delete old file
  if (data.avatarUrl && profile?.avatarUrl) {
    const oldFilename = profile.avatarUrl.split('/').pop();
    if (oldFilename) {
      deleteFile(getAvatarPath(oldFilename));
    }
  }

  await db.update(profiles).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(profiles.id, userId));

  return getMe(userId);
}

/**
 * Self-service: change own password
 */
export async function selfChangePassword(userId: string, currentPassword: string, newPassword: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(404, 'User not found');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new AppError(401, 'Wrong password');

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));

  // Revoke all refresh tokens
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, userId));
}

/**
 * Reissue access + refresh tokens (used after password/email change to keep current session alive)
 */
export async function reissueTokens(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(404, 'User not found');

  const payload = await buildTokenPayload(user.id, user.email);
  const accessToken = signAccessToken(payload);
  const refreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken };
}

/**
 * Switch active organization (reissue tokens with new org context)
 */
export async function switchOrganization(userId: string, organizationId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(404, 'User not found');

  // Verify membership
  const [membership] = await db.select().from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)))
    .limit(1);
  if (!membership) throw new AppError(403, 'Not a member of this organization');

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: membership.role,
    organizationId,
    isSuperAdmin: user.isSuperAdmin,
  });

  const refreshToken = await createRefreshToken(userId);
  return { accessToken, refreshToken };
}

/**
 * Super-admin: impersonate a user (login as them)
 */
export async function impersonateUser(targetUserId: string, impersonatorUserId: string) {
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!target) throw new AppError(404, 'User not found');

  // Prevent impersonating other super-admins
  if (target.isSuperAdmin) throw new AppError(403, 'Cannot impersonate another super admin');

  // Prevent self-impersonation
  if (targetUserId === impersonatorUserId) throw new AppError(400, 'Cannot impersonate yourself');

  const payload = await buildTokenPayload(target.id, target.email);
  const accessToken = signAccessToken(payload);
  const refreshToken = await createRefreshToken(target.id);

  return { accessToken, refreshToken };
}

/**
 * Admin: create user with specified role
 */
export async function adminCreateUser(email: string, password: string, name: string, role: string, phone?: string, organizationId?: string) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new AppError(409, 'Email already registered');

  // Check tenant limit for user role
  if (organizationId && (role === 'user')) {
    await organizationService.checkTenantLimit(organizationId);
  }

  const passwordHash = await hashPassword(password);

  return await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, passwordHash, emailConfirmed: true })
      .returning();

    await tx.insert(profiles).values({
      id: user.id,
      name,
      phone,
    });

    // Legacy role table (kept for backward compat)
    const legacyRole = role === 'org_admin' ? 'admin' : role;
    await tx.insert(userRoles).values({
      userId: user.id,
      role: legacyRole as any,
    });

    // New org membership
    if (organizationId) {
      const orgRole = role === 'admin' ? 'org_admin' : role;
      await tx.insert(organizationMembers).values({
        userId: user.id,
        organizationId,
        role: orgRole as any,
      });
    }

    return { id: user.id, email: user.email };
  });
}

/**
 * Admin: change user password
 */
export async function adminChangePassword(userId: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  // Revoke all refresh tokens for this user
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, userId));
}

/**
 * Admin: disable 2FA for a user
 */
export async function adminDisable2FA(userId: string) {
  await db.delete(totpFactors).where(eq(totpFactors.userId, userId));
}

/**
 * Admin: delete user
 */
export async function adminDeleteUser(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
  return { success: true };
}
