import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { dbRateLimit } from '../middleware/db-rate-limit.js';
import { logger } from '../config/logger.js';

export const contactRoutes = Router();

const contactSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  message: z.string().min(10).max(5000),
});

contactRoutes.post('/', dbRateLimit({ prefix: 'contact', windowMs: 60 * 60 * 1000, max: 5 }), validate(contactSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, message } = req.body;

    logger.info({ name, email, messageLength: message.length }, 'Contact form submission');

    // Try to send email notification
    try {
      const { getRawSettings } = await import('../services/settings.service.js');
      const config = await getRawSettings();
      if (config?.resendApiKey) {
        const { Resend } = await import('resend');
        const resend = new Resend(config.resendApiKey);
        await resend.emails.send({
          from: config.smtpFromEmail || 'noreply@albayt.cloud',
          to: config.smtpFromEmail || 'info@albayt.cloud',
          replyTo: email,
          subject: `Contact Form: ${name}`,
          html: `<div style="font-family:Arial,sans-serif;padding:20px;"><h2>New Contact Form Submission</h2><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><hr/><p>${message.replace(/\n/g, '<br/>')}</p></div>`,
        });
      }
    } catch { /* don't fail if email fails */ }

    res.json({ success: true });
  } catch (err) { next(err); }
});
