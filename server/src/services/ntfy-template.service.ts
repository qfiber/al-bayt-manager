import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { ntfyTemplates, ntfyTemplateTranslations } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

// ─── Default ntfy template definitions ───

const DEFAULT_NTFY_TEMPLATES = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    identifier: 'ntfy_new_issue',
    name: 'New Issue Notification',
    description: 'Push notification sent when a new issue is reported',
    translations: [
      { language: 'ar', title: 'عطل جديد: {{category}}', message: '{{reporterName}}: {{description}}' },
      { language: 'he', title: 'תקלה חדשה: {{category}}', message: '{{reporterName}}: {{description}}' },
      { language: 'en', title: 'New Issue: {{category}}', message: '{{reporterName}}: {{description}}' },
    ],
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    identifier: 'ntfy_payment_reminder',
    name: 'Payment Reminder Notification',
    description: 'Push notification sent for outstanding payment balance',
    translations: [
      { language: 'ar', title: 'تذكير بالدفع', message: 'شقة {{apartmentNumber}} - رصيد مستحق: ₪{{balance}}' },
      { language: 'he', title: 'תזכורת תשלום', message: 'דירה {{apartmentNumber}} - יתרת חוב: ₪{{balance}}' },
      { language: 'en', title: 'Payment Reminder', message: 'Apartment {{apartmentNumber}} has outstanding balance: ₪{{balance}}' },
    ],
  },
];

// ─── Ensure default ntfy templates exist (called on server startup) ───

export async function ensureDefaultNtfyTemplates() {
  for (const tmpl of DEFAULT_NTFY_TEMPLATES) {
    const [existing] = await db
      .select()
      .from(ntfyTemplates)
      .where(eq(ntfyTemplates.identifier, tmpl.identifier))
      .limit(1);

    if (!existing) {
      logger.info(`Seeding default ntfy template: ${tmpl.identifier}`);
      const [created] = await db.insert(ntfyTemplates).values({
        id: tmpl.id,
        identifier: tmpl.identifier,
        name: tmpl.name,
        description: tmpl.description,
      }).returning();

      await db.insert(ntfyTemplateTranslations).values(
        tmpl.translations.map((t) => ({
          templateId: created.id,
          language: t.language,
          title: t.title,
          message: t.message,
        })),
      );
    }
  }
}

// ─── Template CRUD ───

export async function listNtfyTemplates() {
  const templates = await db.select().from(ntfyTemplates).orderBy(ntfyTemplates.name);
  const translations = await db.select().from(ntfyTemplateTranslations);

  return templates.map((t) => ({
    ...t,
    translations: translations.filter((tr) => tr.templateId === t.id),
  }));
}

export async function getNtfyTemplate(id: string) {
  const [template] = await db.select().from(ntfyTemplates).where(eq(ntfyTemplates.id, id)).limit(1);
  if (!template) throw new AppError(404, 'Ntfy template not found');

  const translations = await db
    .select()
    .from(ntfyTemplateTranslations)
    .where(eq(ntfyTemplateTranslations.templateId, id));

  return { ...template, translations };
}

export async function updateNtfyTemplate(id: string, data: { name?: string; description?: string }) {
  const [template] = await db
    .update(ntfyTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(ntfyTemplates.id, id))
    .returning();
  if (!template) throw new AppError(404, 'Ntfy template not found');
  return template;
}

export async function updateNtfyTranslations(templateId: string, translations: {
  language: string;
  title: string;
  message: string;
}[]) {
  return await db.transaction(async (tx) => {
    await tx.delete(ntfyTemplateTranslations).where(eq(ntfyTemplateTranslations.templateId, templateId));

    if (translations.length > 0) {
      await tx.insert(ntfyTemplateTranslations).values(
        translations.map((t) => ({ ...t, templateId })),
      );
    }

    return { success: true };
  });
}

// ─── Resolve a ntfy template for a given identifier + language ───

export async function resolveNtfyTemplate(
  identifier: string,
  preferredLanguage: string,
  variables: Record<string, string>,
): Promise<{ title: string; message: string } | null> {
  try {
    const [template] = await db
      .select()
      .from(ntfyTemplates)
      .where(eq(ntfyTemplates.identifier, identifier))
      .limit(1);

    if (!template) return null;

    const translations = await db
      .select()
      .from(ntfyTemplateTranslations)
      .where(eq(ntfyTemplateTranslations.templateId, template.id));

    const lang = preferredLanguage || 'ar';
    const translation = translations.find((t) => t.language === lang)
      || translations.find((t) => t.language === 'ar')
      || translations.find((t) => t.language === 'en')
      || translations.find((t) => t.language === 'he')
      || translations[0];

    if (!translation) return null;

    let title = translation.title;
    let message = translation.message;
    for (const [key, value] of Object.entries(variables)) {
      title = title.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    return { title, message };
  } catch (err) {
    logger.error(err, `Failed to resolve ntfy template: ${identifier}`);
    return null;
  }
}
