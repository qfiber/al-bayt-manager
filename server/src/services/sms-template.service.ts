import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { smsTemplates, smsTemplateTranslations } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

// ─── Default SMS templates ───

const DEFAULT_SMS_TEMPLATES = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    identifier: 'sms_monthly_reminder',
    name: 'Monthly Subscription Reminder',
    description: 'Sent on the 1st of each month to remind tenants of their monthly subscription',
    translations: [
      { language: 'ar', message: 'مرحباً {{tenantName}}، تذكير بدفع الاشتراك الشهري لشقة {{apartmentNumber}} في {{buildingName}} بقيمة {{currencySymbol}}{{subscriptionAmount}}. شكراً لتعاونكم.' },
      { language: 'he', message: 'שלום {{tenantName}}, תזכורת לתשלום דמי הניהול החודשיים עבור דירה {{apartmentNumber}} ב{{buildingName}} בסך {{currencySymbol}}{{subscriptionAmount}}. תודה על שיתוף הפעולה.' },
      { language: 'en', message: 'Hello {{tenantName}}, reminder to pay your monthly subscription for apartment {{apartmentNumber}} at {{buildingName}}: {{currencySymbol}}{{subscriptionAmount}}. Thank you.' },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    identifier: 'sms_overdue_reminder',
    name: 'Overdue Payment Reminder',
    description: 'Sent on the 7th if tenant has not paid, includes total debt',
    translations: [
      { language: 'ar', message: 'مرحباً {{tenantName}}، لم يتم استلام دفعة الاشتراك الشهري لشقة {{apartmentNumber}} في {{buildingName}}. الرصيد المستحق: {{currencySymbol}}{{balance}}. يرجى الدفع في أقرب وقت لتجنب أي إجراءات إضافية.' },
      { language: 'he', message: 'שלום {{tenantName}}, טרם התקבל תשלום דמי הניהול החודשיים עבור דירה {{apartmentNumber}} ב{{buildingName}}. יתרת חוב: {{currencySymbol}}{{balance}}. אנא בצע תשלום בהקדם למניעת פעולות נוספות.' },
      { language: 'en', message: 'Hello {{tenantName}}, your monthly payment for apartment {{apartmentNumber}} at {{buildingName}} is overdue. Total balance due: {{currencySymbol}}{{balance}}. Please pay as soon as possible to avoid further action.' },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    identifier: 'sms_payment_confirmation',
    name: 'Payment Confirmation',
    description: 'Sent when a payment is recorded on a tenant\'s apartment',
    translations: [
      { language: 'ar', message: 'مرحباً {{tenantName}}، تم تسجيل دفعة بقيمة {{currencySymbol}}{{amount}} لشقة {{apartmentNumber}} في {{buildingName}} عن شهر {{month}}. شكراً لدفعتك.' },
      { language: 'he', message: 'שלום {{tenantName}}, תשלום בסך {{currencySymbol}}{{amount}} נרשם עבור דירה {{apartmentNumber}} ב{{buildingName}} לחודש {{month}}. תודה על התשלום.' },
      { language: 'en', message: 'Hello {{tenantName}}, a payment of {{currencySymbol}}{{amount}} has been recorded for apartment {{apartmentNumber}} at {{buildingName}} for {{month}}. Thank you.' },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000004',
    identifier: 'sms_new_issue_report',
    name: 'New Issue Report',
    description: 'Sent to admins/moderators when a new issue is reported',
    translations: [
      { language: 'ar', message: 'عطل جديد في {{buildingName}}: {{category}} - {{description}}. المُبلّغ: {{reporterName}}.' },
      { language: 'he', message: 'תקלה חדשה ב{{buildingName}}: {{category}} - {{description}}. מדווח: {{reporterName}}.' },
      { language: 'en', message: 'New issue at {{buildingName}}: {{category}} - {{description}}. Reported by: {{reporterName}}.' },
    ],
  },
  {
    id: 'c0000000-0000-0000-0000-000000000005',
    identifier: 'sms_issue_resolved',
    name: 'Issue Resolved',
    description: 'Sent to the reporter when their issue is resolved',
    translations: [
      { language: 'ar', message: 'مرحباً {{tenantName}}، تم حل العطل الذي أبلغت عنه ({{category}}). شكراً لبلاغك.' },
      { language: 'he', message: 'שלום {{tenantName}}, התקלה שדיווחת עליה ({{category}}) טופלה. תודה על הדיווח.' },
      { language: 'en', message: 'Hello {{tenantName}}, your reported issue ({{category}}) has been resolved. Thank you for reporting.' },
    ],
  },
];

// ─── Ensure default templates exist (called on server startup) ───

export async function ensureDefaultSmsTemplates() {
  for (const tmpl of DEFAULT_SMS_TEMPLATES) {
    const [existing] = await db
      .select()
      .from(smsTemplates)
      .where(eq(smsTemplates.identifier, tmpl.identifier))
      .limit(1);

    if (!existing) {
      logger.info(`Seeding default SMS template: ${tmpl.identifier}`);
      const [created] = await db.insert(smsTemplates).values({
        id: tmpl.id,
        identifier: tmpl.identifier,
        name: tmpl.name,
        description: tmpl.description,
      }).returning();

      await db.insert(smsTemplateTranslations).values(
        tmpl.translations.map((t) => ({
          templateId: created.id,
          language: t.language,
          message: t.message,
        })),
      );
    }
  }
}

// ─── Template CRUD ───

export async function listSmsTemplates() {
  const templates = await db.select().from(smsTemplates).orderBy(smsTemplates.name);
  const translations = await db.select().from(smsTemplateTranslations);

  return templates.map((t) => ({
    ...t,
    translations: translations.filter((tr) => tr.templateId === t.id),
  }));
}

export async function getSmsTemplate(id: string) {
  const [template] = await db.select().from(smsTemplates).where(eq(smsTemplates.id, id)).limit(1);
  if (!template) throw new AppError(404, 'SMS template not found');

  const translations = await db
    .select()
    .from(smsTemplateTranslations)
    .where(eq(smsTemplateTranslations.templateId, id));

  return { ...template, translations };
}

export async function updateSmsTemplate(id: string, data: { name?: string; description?: string }) {
  const [template] = await db
    .update(smsTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(smsTemplates.id, id))
    .returning();
  if (!template) throw new AppError(404, 'SMS template not found');
  return template;
}

export async function updateSmsTranslations(templateId: string, translations: {
  language: string;
  message: string;
}[]) {
  return await db.transaction(async (tx) => {
    await tx.delete(smsTemplateTranslations).where(eq(smsTemplateTranslations.templateId, templateId));

    if (translations.length > 0) {
      await tx.insert(smsTemplateTranslations).values(
        translations.map((t) => ({ ...t, templateId })),
      );
    }

    return { success: true };
  });
}

// ─── Resolve template for sending ───

export async function resolveSmsTemplate(
  identifier: string,
  preferredLanguage: string,
  variables: Record<string, string>,
): Promise<string | null> {
  try {
    const [template] = await db
      .select()
      .from(smsTemplates)
      .where(eq(smsTemplates.identifier, identifier))
      .limit(1);

    if (!template) return null;

    const translations = await db
      .select()
      .from(smsTemplateTranslations)
      .where(eq(smsTemplateTranslations.templateId, template.id));

    const lang = preferredLanguage || 'ar';
    const translation = translations.find((t) => t.language === lang)
      || translations.find((t) => t.language === 'ar')
      || translations.find((t) => t.language === 'en')
      || translations.find((t) => t.language === 'he')
      || translations[0];

    if (!translation) return null;

    let message = translation.message;
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    return message;
  } catch (err) {
    logger.error(err, `Failed to resolve SMS template: ${identifier}`);
    return null;
  }
}

// ─── Available template variables (for admin reference) ───

export const SMS_TEMPLATE_VARIABLES: Record<string, { variables: string[]; description: Record<string, string> }> = {
  sms_monthly_reminder: {
    variables: ['tenantName', 'apartmentNumber', 'buildingName', 'subscriptionAmount', 'currencySymbol'],
    description: {
      ar: 'تذكير اشتراك شهري',
      he: 'תזכורת דמי ניהול חודשיים',
      en: 'Monthly subscription reminder',
    },
  },
  sms_overdue_reminder: {
    variables: ['tenantName', 'apartmentNumber', 'buildingName', 'balance', 'currencySymbol'],
    description: {
      ar: 'تذكير بتأخر الدفع',
      he: 'תזכורת איחור בתשלום',
      en: 'Overdue payment reminder',
    },
  },
  sms_payment_confirmation: {
    variables: ['tenantName', 'apartmentNumber', 'buildingName', 'amount', 'month', 'currencySymbol'],
    description: {
      ar: 'تأكيد دفعة',
      he: 'אישור תשלום',
      en: 'Payment confirmation',
    },
  },
  sms_new_issue_report: {
    variables: ['buildingName', 'category', 'description', 'reporterName'],
    description: {
      ar: 'تقرير عطل جديد',
      he: 'דיווח תקלה חדש',
      en: 'New issue report',
    },
  },
  sms_issue_resolved: {
    variables: ['tenantName', 'category', 'description'],
    description: {
      ar: 'إشعار حل عطل',
      he: 'הודעה על טיפול בתקלה',
      en: 'Issue resolved notification',
    },
  },
};
