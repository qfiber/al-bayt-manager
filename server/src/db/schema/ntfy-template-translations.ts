import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { ntfyTemplates } from './ntfy-templates.js';

export const ntfyTemplateTranslations = pgTable('ntfy_template_translations', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => ntfyTemplates.id, { onDelete: 'cascade' }),
  language: varchar('language', { length: 10 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
