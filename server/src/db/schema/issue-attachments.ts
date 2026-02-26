import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { issueReports } from './issue-reports.js';

export const issueAttachments = pgTable('issue_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  issueId: uuid('issue_id').notNull().references(() => issueReports.id, { onDelete: 'cascade' }),
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  fileType: varchar('file_type', { length: 20 }).notNull(), // 'image' | 'video'
  originalName: varchar('original_name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
