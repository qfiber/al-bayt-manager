import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { auditLog } from '../middleware/audit.js';
import * as emailService from '../services/email.service.js';
import * as ntfyTemplateService from '../services/ntfy-template.service.js';
import * as smsTemplateService from '../services/sms-template.service.js';
import { listSmsLogs } from '../services/sms.service.js';
import { sendMonthlyReminders, sendOverdueReminders } from '../services/sms-cron.service.js';
import { dbRateLimit } from '../middleware/db-rate-limit.js';

export const emailRoutes = Router();

const idParams = z.object({ id: z.string().uuid() });

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

const ntfyTranslationsSchema = z.object({
  translations: z.array(z.object({
    language: z.enum(['ar', 'en', 'he']),
    title: z.string().min(1).max(500),
    message: z.string().min(1).max(5000),
  })).max(3),
});

const smsTranslationsSchema = z.object({
  translations: z.array(z.object({
    language: z.enum(['ar', 'en', 'he']),
    message: z.string().min(1).max(1005),
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
    const result = await emailService.getTemplate(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.put('/templates/:id', requireAuth, requireRole('admin'), validate({ params: idParams, body: updateTemplateSchema }), auditLog('update', 'email_templates'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.updateTemplate(req.params.id as string, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.put('/templates/:id/translations', requireAuth, requireRole('admin'), validate({ params: idParams, body: translationsSchema }), auditLog('update', 'email_template_translations'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.updateTranslations(req.params.id as string, req.body.translations);
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

// ─── Ntfy Template Routes ───

emailRoutes.get('/ntfy-templates', requireAuth, requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ntfyTemplateService.listNtfyTemplates();
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.get('/ntfy-templates/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ntfyTemplateService.getNtfyTemplate(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.put('/ntfy-templates/:id', requireAuth, requireRole('admin'), validate({ params: idParams, body: updateTemplateSchema }), auditLog('update', 'ntfy_templates'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ntfyTemplateService.updateNtfyTemplate(req.params.id as string, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.put('/ntfy-templates/:id/translations', requireAuth, requireRole('admin'), validate({ params: idParams, body: ntfyTranslationsSchema }), auditLog('update', 'ntfy_template_translations'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ntfyTemplateService.updateNtfyTranslations(req.params.id as string, req.body.translations);
    res.json(result);
  } catch (err) { next(err); }
});

// ─── SMS Template Routes ───

emailRoutes.get('/sms-templates', requireAuth, requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await smsTemplateService.listSmsTemplates();
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.get('/sms-templates/variables', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  res.json(smsTemplateService.SMS_TEMPLATE_VARIABLES);
});

emailRoutes.get('/sms-templates/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await smsTemplateService.getSmsTemplate(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.put('/sms-templates/:id', requireAuth, requireRole('admin'), validate({ params: idParams, body: updateTemplateSchema }), auditLog('update', 'sms_templates'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await smsTemplateService.updateSmsTemplate(req.params.id as string, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

emailRoutes.put('/sms-templates/:id/translations', requireAuth, requireRole('admin'), validate({ params: idParams, body: smsTranslationsSchema }), auditLog('update', 'sms_template_translations'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await smsTemplateService.updateSmsTranslations(req.params.id as string, req.body.translations);
    res.json(result);
  } catch (err) { next(err); }
});

// ─── SMS Logs ───

const smsLogQuerySchema = z.object({
  status: z.enum(['sent', 'failed']).optional(),
  templateIdentifier: z.string().max(100).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

emailRoutes.get('/sms-logs', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = smsLogQuerySchema.parse(req.query);
    const result = await listSmsLogs(query);
    res.json(result);
  } catch (err) { next(err); }
});

// ─── Manual SMS Trigger ───

const triggerSchema = z.object({
  type: z.enum(['monthly', 'overdue']),
});

emailRoutes.post('/sms-trigger', requireAuth, requireRole('admin'), dbRateLimit({ prefix: 'sms_trigger', windowMs: 10 * 60 * 1000, max: 3 }), validate(triggerSchema), auditLog('create', 'sms_trigger'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.body;
    if (type === 'monthly') {
      sendMonthlyReminders().catch(() => {});
    } else {
      sendOverdueReminders().catch(() => {});
    }
    res.json({ success: true, message: `${type} SMS reminders triggered` });
  } catch (err) { next(err); }
});
