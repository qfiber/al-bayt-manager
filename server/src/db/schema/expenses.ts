import { pgTable, uuid, varchar, numeric, date, boolean, timestamp } from 'drizzle-orm/pg-core';
import { buildings } from './buildings.js';

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  buildingId: uuid('building_id').notNull().references(() => buildings.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 500 }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  expenseDate: date('expense_date').notNull(),
  category: varchar('category', { length: 255 }),
  isRecurring: boolean('is_recurring').default(false),
  recurringType: varchar('recurring_type', { length: 50 }),
  recurringStartDate: date('recurring_start_date'),
  recurringEndDate: date('recurring_end_date'),
  parentExpenseId: uuid('parent_expense_id').references((): any => expenses.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
