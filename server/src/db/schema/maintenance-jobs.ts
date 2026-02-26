import { pgTable, uuid, varchar, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { buildings } from './buildings.js';
import { issueReports } from './issue-reports.js';
import { expenses } from './expenses.js';
import { profiles } from './profiles.js';
import { maintenanceStatusEnum } from './enums.js';

export const maintenanceJobs = pgTable('maintenance_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  buildingId: uuid('building_id').notNull().references(() => buildings.id, { onDelete: 'cascade' }),
  issueId: uuid('issue_id').references(() => issueReports.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  estimatedCost: numeric('estimated_cost', { precision: 12, scale: 2 }),
  status: maintenanceStatusEnum('status').default('pending').notNull(),
  expenseId: uuid('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
