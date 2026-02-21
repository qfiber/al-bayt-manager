import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { auditLog } from '../middleware/audit.js';
import * as settingsService from '../services/settings.service.js';

export const settingsRoutes = Router();

const updateSettingsSchema = z.object({
  systemLanguage: z.enum(['ar', 'he', 'en']).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  smtpEnabled: z.boolean().optional(),
  smtpFromEmail: z.string().email().max(255).nullable().optional(),
  smtpFromName: z.string().max(255).nullable().optional(),
  resendApiKey: z.string().max(500).nullable().optional(),
  turnstileEnabled: z.boolean().optional(),
  turnstileSiteKey: z.string().max(255).nullable().optional(),
  turnstileSecretKey: z.string().max(255).nullable().optional(),
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
