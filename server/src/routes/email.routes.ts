import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { auditLog } from '../middleware/audit.js';
import * as emailService from '../services/email.service.js';

export const emailRoutes = Router();

const idParams = z.object({ id: z.string().uuid() });

const createTemplateSchema = z.object({
  identifier: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Identifier must be lowercase alphanumeric with underscores'),
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
});

const translationsSchema = z.object({
  translations: z.array(z.object({
    language: z.enum(['ar', 'en', 'he']),
    subject: z.string().min(1).max(500),
    htmlBody: z.string().min(1).max(50000),
  })).max(3),
});

const sendEmailSchema = z.object({
  templateIdentifier: z.string().min(1).max(100),
  recipientEmail: z.string().email(),
  userId: z.string().uuid().optional(),
  preferredLanguage: z.enum(['ar', 'en', 'he']).optional(),
  variables: z.record(z.string().max(1000)).optional(),
});

const dateRegex = /^\d{4}-\d{2}-\d{2}/;

const emailLogQuerySchema = z.object({
  status: z.enum(['sent', 'failed', 'skipped']).optional(),
  templateIdentifier: z.string().max(100).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

emailRoutes.get('/templates', requireAuth, requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.listTemplates();
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.get('/templates/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.getTemplate(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.post('/templates', requireAuth, requireRole('admin'), validate(createTemplateSchema), auditLog('create', 'email_templates'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.createTemplate(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

emailRoutes.put('/templates/:id', requireAuth, requireRole('admin'), validate({ params: idParams, body: updateTemplateSchema }), auditLog('update', 'email_templates'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.updateTemplate(req.params.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.delete('/templates/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), auditLog('delete', 'email_templates'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.deleteTemplate(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.put('/templates/:id/translations', requireAuth, requireRole('admin'), validate({ params: idParams, body: translationsSchema }), auditLog('update', 'email_template_translations'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.updateTranslations(req.params.id, req.body.translations);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.post('/send', requireAuth, requireRole('admin'), validate(sendEmailSchema), auditLog('create', 'email_logs'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.sendEmail(req.body);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.get('/logs', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = emailLogQuerySchema.parse(req.query);
    const result = await emailService.listEmailLogs(query);
    res.json(result);
  } catch (err) { next(err); }
});
