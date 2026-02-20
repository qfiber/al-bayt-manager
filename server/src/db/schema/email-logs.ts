import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const emailLogs = pgTable('email_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateIdentifier: varchar('template_identifier', { length: 255 }),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  userId: uuid('user_id'),
  status: varchar('status', { length: 50 }).notNull(),
  failureReason: text('failure_reason'),
  subjectSent: varchar('subject_sent', { length: 500 }),
  metadata: jsonb('metadata'),
  languageUsed: varchar('language_used', { length: 10 }),
  userPreferredLanguage: varchar('user_preferred_language', { length: 10 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
