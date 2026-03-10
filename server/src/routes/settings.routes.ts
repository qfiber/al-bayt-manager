import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { auditLog } from '../middleware/audit.js';
import * as settingsService from '../services/settings.service.js';
import { sendTestSms } from '../services/sms.service.js';

export const settingsRoutes = Router();

const updateSettingsSchema = z.object({
  companyName: z.string().max(255).nullable().optional(),
  systemLanguage: z.enum(['ar', 'he', 'en']).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  smtpEnabled: z.boolean().optional(),
  smtpFromEmail: z.string().email().max(255).nullable().optional(),
  smtpFromName: z.string().max(255).nullable().optional(),
  resendApiKey: z.string().max(500).nullable().optional(),
  turnstileEnabled: z.boolean().optional(),
  turnstileSiteKey: z.string().max(255).nullable().optional(),
  turnstileSecretKey: z.string().max(255).nullable().optional(),
  registrationEnabled: z.boolean().optional(),
  ntfyEnabled: z.boolean().optional(),
  ntfyServerUrl: z.string().url().max(500).nullable().optional(),
  smsEnabled: z.boolean().optional(),
  smsProvider: z.string().max(50).nullable().optional(),
  smsApiToken: z.string().max(500).nullable().optional(),
  smsUsername: z.string().max(255).nullable().optional(),
  smsSenderName: z.string().max(11).nullable().optional(),
  currencyCode: z.string().min(3).max(3).optional(),
  currencySymbol: z.string().min(1).max(5).optional(),
});

const testSmsSchema = z.object({
  phone: z.string().min(7).max(20),
});

// Public endpoint (no auth required) — must be before authenticated routes
settingsRoutes.get('/public', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await settingsService.getPublicSettings();
    res.json(result);
  } catch (err) { next(err); }
});

settingsRoutes.get('/', requireAuth, requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await settingsService.getSettings();
    res.json(result);
  } catch (err) { next(err); }
});

settingsRoutes.put('/', requireAuth, requireRole('admin'), validate(updateSettingsSchema), auditLog('update', 'settings'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await settingsService.updateSettings(req.body);
    res.json(result);
  } catch (err) { next(err); }
});

settingsRoutes.post('/test-sms', requireAuth, requireRole('admin'), validate(testSmsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await sendTestSms(req.body.phone);
    res.json(result);
  } catch (err) { next(err); }
});
