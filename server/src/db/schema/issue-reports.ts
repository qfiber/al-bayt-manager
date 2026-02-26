import { pgTable, uuid, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { buildings } from './buildings.js';
import { profiles } from './profiles.js';
import { issueStatusEnum, issueCategoryEnum } from './enums.js';

export const issueReports = pgTable('issue_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  buildingId: uuid('building_id').notNull().references(() => buildings.id, { onDelete: 'cascade' }),
  reporterId: uuid('reporter_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  floor: integer('floor'),
  category: issueCategoryEnum('category').notNull(),
  description: text('description').notNull(),
  status: issueStatusEnum('status').default('open').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
