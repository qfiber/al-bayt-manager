import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { apartments } from './apartments.js';
import { debtCollectionStages } from './debt-collection-stages.js';

export const debtCollectionLog = pgTable('debt_collection_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  apartmentId: uuid('apartment_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  stageId: uuid('stage_id').notNull().references(() => debtCollectionStages.id, { onDelete: 'cascade' }),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).defaultNow().notNull(),
  actionTaken: varchar('action_taken', { length: 255 }),
  details: jsonb('details').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_debt_collection_log_apartment').on(table.apartmentId),
]);
