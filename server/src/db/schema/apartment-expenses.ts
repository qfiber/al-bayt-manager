import { pgTable, uuid, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { apartments } from './apartments.js';
import { expenses } from './expenses.js';

export const apartmentExpenses = pgTable('apartment_expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  apartmentId: uuid('apartment_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  expenseId: uuid('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0').notNull(),
  isCanceled: boolean('is_canceled').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
