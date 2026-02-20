import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { emailTemplates, emailTemplateTranslations, emailLogs, settings } from '../db/schema/index.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export async function listTemplates() {
  return db.select().from(emailTemplates).orderBy(emailTemplates.name);
}

export async function getTemplate(id: string) {
  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
  if (!template) throw new AppError(404, 'Template not found');

  const translations = await db
    .select()
    .from(emailTemplateTranslations)
    .where(eq(emailTemplateTranslations.templateId, id));

  return { ...template, translations };
}

export async function createTemplate(data: { identifier: string; name: string; description?: string }) {
  const [template] = await db.insert(emailTemplates).values(data).returning();
  return template;
}

export async function updateTemplate(id: string, data: { name?: string; description?: string }) {
  const [template] = await db
    .update(emailTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(emailTemplates.id, id))
    .returning();
  if (!template) throw new AppError(404, 'Template not found');
  return template;
}

export async function deleteTemplate(id: string) {
  const [template] = await db.delete(emailTemplates).where(eq(emailTemplates.id, id)).returning();
  if (!template) throw new AppError(404, 'Template not found');
  return { success: true };
}

export async function updateTranslations(templateId: string, translations: {
  language: string;
  subject: string;
  htmlBody: string;
}[]) {
  return await db.transaction(async (tx) => {
    // Delete existing translations for this template
    await tx.delete(emailTemplateTranslations).where(eq(emailTemplateTranslations.templateId, templateId));

    // Insert new translations
    if (translations.length > 0) {
      await tx.insert(emailTemplateTranslations).values(
        translations.map((t) => ({ ...t, templateId })),
      );
    }

    return { success: true };
  });
}

export async function sendEmail(data: {
  templateIdentifier: string;
  recipientEmail: string;
  userId?: string;
  preferredLanguage?: string;
  variables?: Record<string, string>;
}) {
  // Get settings for SMTP config
  const [config] = await db.select().from(settings).limit(1);
  if (!config?.smtpEnabled || !config?.resendApiKey) {
    await logEmailAttempt(data.templateIdentifier, data.recipientEmail, data.userId, 'skipped', 'SMTP not enabled', data.preferredLanguage);
    throw new AppError(400, 'Email sending is not configured');
  }

  // Find template
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.identifier, data.templateIdentifier))
    .limit(1);
  if (!template) throw new AppError(404, 'Template not found');

  // Find best translation
  const translations = await db
    .select()
    .from(emailTemplateTranslations)
    .where(eq(emailTemplateTranslations.templateId, template.id));

  const lang = data.preferredLanguage || 'ar';
  let translation = translations.find((t) => t.language === lang)
    || translations.find((t) => t.language === 'ar')
    || translations.find((t) => t.language === 'en')
    || translations.find((t) => t.language === 'he')
    || translations[0];

  if (!translation) {
    await logEmailAttempt(data.templateIdentifier, data.recipientEmail, data.userId, 'failed', 'No translation found', data.preferredLanguage);
    throw new AppError(400, 'No translation found for template');
  }

  // Replace variables
  let subject = translation.subject;
  let body = translation.htmlBody;
  if (data.variables) {
    for (const [key, value] of Object.entries(data.variables)) {
      subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(config.resendApiKey);

    await resend.emails.send({
      from: `${config.smtpFromName || 'Al-Bayt Manager'} <${config.smtpFromEmail || 'noreply@example.com'}>`,
      to: [data.recipientEmail],
      subject,
      html: body,
    });

    await logEmailAttempt(data.templateIdentifier, data.recipientEmail, data.userId, 'sent', undefined, translation.language, subject);
    return { success: true };
  } catch (err: any) {
    await logEmailAttempt(data.templateIdentifier, data.recipientEmail, data.userId, 'failed', err.message, data.preferredLanguage);
    throw new AppError(500, 'Failed to send email');
  }
}

async function logEmailAttempt(
  templateIdentifier: string,
  recipientEmail: string,
  userId: string | undefined,
  status: string,
  failureReason?: string,
  languageUsed?: string,
  subjectSent?: string,
) {
  await db.insert(emailLogs).values({
    templateIdentifier,
    recipientEmail,
    userId,
    status,
    failureReason,
    languageUsed,
    subjectSent,
  }).catch((err) => logger.error(err, 'Email log error'));
}

export async function listEmailLogs(filters?: {
  status?: string;
  templateIdentifier?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  const { limit = 100, offset = 0 } = filters || {};

  let query = db.select().from(emailLogs);

  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(emailLogs.status, filters.status));
  if (filters?.templateIdentifier) conditions.push(eq(emailLogs.templateIdentifier, filters.templateIdentifier));
  if (filters?.startDate) conditions.push(gte(emailLogs.createdAt, new Date(filters.startDate)));
  if (filters?.endDate) conditions.push(lte(emailLogs.createdAt, new Date(filters.endDate)));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query.orderBy(desc(emailLogs.createdAt)).limit(limit).offset(offset);
}
