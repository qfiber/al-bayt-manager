import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { auditActionTypeEnum } from './enums.js';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  userEmail: varchar('user_email', { length: 255 }),
  actionType: auditActionTypeEnum('action_type').notNull(),
  tableName: varchar('table_name', { length: 255 }),
  recordId: varchar('record_id', { length: 255 }),
  actionDetails: jsonb('action_details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
