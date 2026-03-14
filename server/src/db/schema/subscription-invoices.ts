import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const subscriptionInvoices = pgTable('subscription_invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('ILS').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'), // pending, paid, failed, cancelled
  billingCycle: varchar('billing_cycle', { length: 20 }),
  periodStart: timestamp('period_start', { withTimezone: true }),
  periodEnd: timestamp('period_end', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
