import { pgTable, uuid, varchar, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { apartments } from './apartments.js';

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  apartmentId: uuid('apartment_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  month: varchar('month', { length: 7 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  isCanceled: boolean('is_canceled').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
