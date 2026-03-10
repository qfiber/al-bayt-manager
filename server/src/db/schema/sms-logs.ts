import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const smsLogs = pgTable('sms_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateIdentifier: varchar('template_identifier', { length: 255 }),
  recipientPhone: varchar('recipient_phone', { length: 50 }).notNull(),
  userId: uuid('user_id'),
  status: varchar('status', { length: 50 }).notNull(),
  failureReason: text('failure_reason'),
  messageSent: text('message_sent'),
  languageUsed: varchar('language_used', { length: 10 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
