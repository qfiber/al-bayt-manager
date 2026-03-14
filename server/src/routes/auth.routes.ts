import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePow } from '../middleware/pow.js';
import { dbRateLimit } from '../middleware/db-rate-limit.js';
import { createChallenge } from '../services/pow.service.js';
import * as authService from '../services/auth.service.js';
import { logAuditEvent } from '../services/audit.service.js';
import { checkAccountLockout, recordFailedLogin, clearFailedAttempts } from '../services/account-lockout.service.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookie.js';
import { generateOtp, createEmailChangeSession, consumeEmailChangeSession } from '../services/email-change.service.js';
import { sendOtpEmail } from '../services/email.service.js';
import { comparePassword } from '../utils/bcrypt.js';
import { verifyTotpCode } from '../utils/totp.js';
import { db } from '../config/database.js';
import { users, refreshTokens, totpFactors, settings, organizationMembers, organizations, profiles } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

export const authRoutes = Router();

/** DB-backed rate limiters */
const authRateLimit = dbRateLimit({ prefix: 'auth', windowMs: 15 * 60 * 1000, max: 5, message: 'Too many attempts, please try again later' });
const refreshRateLimit = dbRateLimit({ prefix: 'refresh', windowMs: 15 * 60 * 1000, max: 10, message: 'Too many refresh attempts, please try again later' });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(16).max(72),
  challengeId: z.string().uuid(),
  nonce: z.string(),
});

const login2FASchema = z.object({
  sessionToken: z.string().min(1),
  code: z.string().length(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(16).max(72),
  name: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
  organizationName: z.string().min(1).max(255).optional(),
  challengeId: z.string().uuid(),
  nonce: z.string(),
});

const verify2FASchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().length(6),
});

const unenroll2FASchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().length(6),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).optional(),
  preferredLanguage: z.enum(['ar', 'he', 'en']).optional(),
  avatarUrl: z.string().max(500).optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  smsNotificationsEnabled: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(16).max(72),
});

const requestEmailChangeSchema = z.object({
  newEmail: z.string().email(),
  currentPassword: z.string().min(1),
});

const confirmEmailChangeSchema = z.object({
  sessionToken: z.string().min(1),
  otp: z.string().length(6),
  totpCode: z.string().length(6).optional(),
});

// Public: get a PoW challenge
authRoutes.get('/challenge', (_req: Request, res: Response) => {
  res.json(createChallenge());
});

authRoutes.post('/login', authRateLimit, requirePow, validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent']?.slice(0, 500);

    // Check account lockout before attempting authentication
    const lockout = await checkAccountLockout(email);
    if (lockout.locked) {
      res.status(423).json({
        error: 'Account temporarily locked due to too many failed attempts',
        lockedUntil: lockout.lockedUntil?.toISOString(),
      });
      return;
    }

    let result;
    try {
      result = await authService.signIn(email, password);
    } catch (err: any) {
      // Record failed login attempt on authentication failure
      if (err.statusCode === 401) {
        await recordFailedLogin(email, ip, ua);
      }
      throw err;
    }

    // Successful login — clear failed attempts
    await clearFailedAttempts(email);

    // Check email verification
    const [loginUser] = await db.select({ emailConfirmed: users.emailConfirmed }).from(users).where(eq(users.email, email)).limit(1);
    const [loginConfig] = await db.select({ emailVerificationEnabled: settings.emailVerificationEnabled }).from(settings).limit(1);
    if (loginConfig?.emailVerificationEnabled && !loginUser?.emailConfirmed) {
      res.status(403).json({ error: 'Email not verified. Please check your email for the verification code.' });
      return;
    }

    if (result.requires2FA) {
      res.json({ requires2FA: true, sessionToken: result.sessionToken });
      return;
    }

    setAuthCookies(res, result.accessToken!, result.refreshToken!);

    logAuditEvent({
      userEmail: email,
      actionType: 'login',
      actionDetails: { method: 'password' },
      ipAddress: ip,
      userAgent: ua,
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) { next(err); }
});

authRoutes.post('/login/2fa', authRateLimit, validate(login2FASchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.verifyTotpLogin(req.body.sessionToken, req.body.code);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    logAuditEvent({
      userId: result.userId,
      actionType: 'login',
      actionDetails: { method: '2fa' },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']?.slice(0, 500),
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) { next(err); }
});

authRoutes.post('/register', authRateLimit, requirePow, validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.signUp(req.body.email, req.body.password, req.body.name, req.body.phone, req.body.organizationName);
    logAuditEvent({
      userId: result.id,
      userEmail: req.body.email,
      actionType: 'signup',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']?.slice(0, 500),
    }).catch(() => {});
    res.status(201).json(result);
  } catch (err) { next(err); }
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
  code: z.string().length(6),
});

const resendVerificationSchema = z.object({
  token: z.string().min(1),
});

authRoutes.post('/verify-email', validate(verifyEmailSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { verifyCode } = await import('../services/email-verification.service.js');
    const { userId } = verifyCode(req.body.token, req.body.code);

    // Mark email as confirmed
    await db.update(users).set({ emailConfirmed: true }).where(eq(users.id, userId));

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Verification failed' });
  }
});

authRoutes.post('/resend-verification', authRateLimit, validate(resendVerificationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getSessionByToken, createVerificationSession } = await import('../services/email-verification.service.js');
    const existing = getSessionByToken(req.body.token);
    if (!existing) { res.status(400).json({ error: 'Session expired, please register again' }); return; }

    const { token, code } = createVerificationSession(existing.userId, existing.email);

    try {
      const { sendVerificationEmail } = await import('../services/email.service.js');
      await sendVerificationEmail(existing.email, code);
    } catch {
      // Don't fail if email send fails
    }

    res.json({ success: true, token });
  } catch (err) { next(err); }
});

authRoutes.post('/refresh', refreshRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }

    const result = await authService.refreshTokensService(refreshToken);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ success: true });
  } catch (err) { next(err); }
});

authRoutes.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (refreshToken) {
      await authService.signOut(refreshToken);
    }

    clearAuthCookies(res);

    res.json({ success: true });
  } catch (err) { next(err); }
});

authRoutes.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.getMe(req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

authRoutes.get('/my-organizations', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memberships = await db
      .select({
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
        name: organizations.name,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, req.user!.userId));
    res.json(memberships);
  } catch (err) { next(err); }
});

const switchOrgSchema = z.object({
  organizationId: z.string().uuid(),
});

authRoutes.post('/switch-organization', requireAuth, validate(switchOrgSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.switchOrganization(req.user!.userId, req.body.organizationId);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ success: true });
  } catch (err) { next(err); }
});

authRoutes.post('/2fa/enroll', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.enrollTotp(req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

authRoutes.post('/2fa/verify', requireAuth, validate(verify2FASchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.verifyTotpEnrollment(req.user!.userId, req.body.factorId, req.body.code);
    res.json(result);
  } catch (err) { next(err); }
});

authRoutes.post('/2fa/unenroll', requireAuth, validate(unenroll2FASchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.unenrollTotp(req.user!.userId, req.body.factorId, req.body.code);
    res.json(result);
  } catch (err) { next(err); }
});

authRoutes.get('/2fa/factors', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.getFactors(req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// GDPR: Download personal data
authRoutes.get('/my-data/export', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Gather all user data
    const [user] = await db.select({ id: users.id, email: users.email, createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);

    const { userApartments: userAptTable } = await import('../db/schema/index.js');
    const aptAssignments = await db.select().from(userAptTable).where(eq(userAptTable.userId, userId));
    const orgMemberships = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId));

    const exportData = {
      exportDate: new Date().toISOString(),
      user: { id: user?.id, email: user?.email, createdAt: user?.createdAt },
      profile,
      apartmentAssignments: aptAssignments,
      organizationMemberships: orgMemberships,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="my-data-export.json"');
    res.json(exportData);
  } catch (err) { next(err); }
});

authRoutes.put('/profile', requireAuth, validate(updateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.updateProfile(req.user!.userId, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

authRoutes.post('/change-password', requireAuth, validate(changePasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.selfChangePassword(req.user!.userId, req.body.currentPassword, req.body.newPassword);
    const tokens = await authService.reissueTokens(req.user!.userId);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.json({ success: true });
  } catch (err) { next(err); }
});

authRoutes.post('/request-email-change', requireAuth, validate(requestEmailChangeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { newEmail, currentPassword } = req.body;

    // Verify current password
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: 'Wrong password' }); return; }

    // Check email uniqueness
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail)).limit(1);
    if (existing) { res.status(409).json({ error: 'Email already in use' }); return; }

    // Generate OTP & session
    const otp = generateOtp();
    const sessionToken = createEmailChangeSession(userId, newEmail, otp);

    // Send OTP to current email
    try {
      await sendOtpEmail(user.email, otp, req.body.preferredLanguage || 'ar');
    } catch {
      // Still return session token even if email fails (for dev/testing)
    }

    res.json({ sessionToken });
  } catch (err) { next(err); }
});

authRoutes.put('/confirm-email-change', requireAuth, validate(confirmEmailChangeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { sessionToken, otp, totpCode } = req.body;

    // Consume OTP session
    let result: { userId: string; newEmail: string };
    try {
      result = consumeEmailChangeSession(sessionToken, otp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
      return;
    }

    // Verify session belongs to current user
    if (result.userId !== userId) {
      res.status(403).json({ error: 'Session mismatch' });
      return;
    }

    // Check if user has verified TOTP factor → require totpCode
    const [factor] = await db
      .select()
      .from(totpFactors)
      .where(and(eq(totpFactors.userId, userId), eq(totpFactors.status, 'verified')))
      .limit(1);

    if (factor) {
      if (!totpCode) {
        res.status(400).json({ error: 'TOTP code required' });
        return;
      }
      const totpValid = verifyTotpCode(factor.secret, totpCode);
      if (!totpValid) {
        res.status(400).json({ error: 'Invalid TOTP code' });
        return;
      }
    }

    // Update email
    await db.update(users).set({ email: result.newEmail, updatedAt: new Date() }).where(eq(users.id, userId));

    // Revoke all refresh tokens
    await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, userId));

    // Reissue tokens
    const tokens = await authService.reissueTokens(userId);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    res.json({ success: true });
  } catch (err) { next(err); }
});
