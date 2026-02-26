import { pgTable, uuid, numeric, timestamp } from 'drizzle-orm/pg-core';
import { payments } from './payments.js';
import { apartmentExpenses } from './apartment-expenses.js';
import { apartmentLedger } from './apartment-ledger.js';

export const paymentAllocations = pgTable('payment_allocations', {
  id: uuid('id').defaultRandom().primaryKey(),
  paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  apartmentExpenseId: uuid('apartment_expense_id').references(() => apartmentExpenses.id, { onDelete: 'cascade' }),
  ledgerEntryId: uuid('ledger_entry_id').references(() => apartmentLedger.id, { onDelete: 'cascade' }),
  amountAllocated: numeric('amount_allocated', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
