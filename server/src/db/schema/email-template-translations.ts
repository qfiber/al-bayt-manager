import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { emailTemplates } from './email-templates.js';

export const emailTemplateTranslations = pgTable('email_template_translations', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => emailTemplates.id, { onDelete: 'cascade' }),
  language: varchar('language', { length: 10 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  htmlBody: text('html_body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
