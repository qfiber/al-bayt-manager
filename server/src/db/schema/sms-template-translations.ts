import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { smsTemplates } from './sms-templates.js';

export const smsTemplateTranslations = pgTable('sms_template_translations', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => smsTemplates.id, { onDelete: 'cascade' }),
  language: varchar('language', { length: 10 }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
