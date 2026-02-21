import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePow } from '../middleware/pow.js';
import { authRateLimit, refreshRateLimit } from '../middleware/rate-limit.js';
import { createChallenge } from '../services/pow.service.js';
import * as authService from '../services/auth.service.js';
import { logAuditEvent } from '../services/audit.service.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookie.js';

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  challengeId: z.string().uuid(),
  nonce: z.string(),
});

const login2FASchema = z.object({
  sessionToken: z.string().min(1),
  code: z.string().length(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
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

// Public: get a PoW challenge
authRoutes.get('/challenge', (_req: Request, res: Response) => {
  res.json(createChallenge());
});

authRoutes.post('/login', authRateLimit, requirePow, validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.signIn(req.body.email, req.body.password);

    if (result.requires2FA) {
      res.json({ requires2FA: true, sessionToken: result.sessionToken });
      return;
    }

    setAuthCookies(res, result.accessToken!, result.refreshToken!);

    logAuditEvent({
      userEmail: req.body.email,
      actionType: 'login',
      actionDetails: { method: 'password' },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']?.slice(0, 500),
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
    const result = await authService.signUp(req.body.email, req.body.password, req.body.name, req.body.phone);
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

    logAuditEvent({
      actionType: 'logout',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']?.slice(0, 500),
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) { next(err); }
});

authRoutes.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.getMe(req.user!.userId);
    res.json(result);
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
