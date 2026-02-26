import { pgTable, uuid, varchar, integer, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { collectionActionTypeEnum } from './enums.js';
import { emailTemplates } from './email-templates.js';

export const debtCollectionStages = pgTable('debt_collection_stages', {
  id: uuid('id').defaultRandom().primaryKey(),
  stageNumber: integer('stage_number').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  daysOverdue: integer('days_overdue').notNull(),
  actionType: collectionActionTypeEnum('action_type').notNull(),
  templateId: uuid('template_id').references(() => emailTemplates.id, { onDelete: 'set null' }),
  settings: jsonb('settings').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
