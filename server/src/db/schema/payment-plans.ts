import { pgTable, uuid, varchar, numeric, integer, date, timestamp } from 'drizzle-orm/pg-core';
import { apartments } from './apartments.js';
import { organizations } from './organizations.js';

export const paymentPlans = pgTable('payment_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  apartmentId: uuid('apartment_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  installments: integer('installments').notNull(),
  amountPerInstallment: numeric('amount_per_installment', { precision: 12, scale: 2 }).notNull(),
  paidInstallments: integer('paid_installments').default(0).notNull(),
  startDate: date('start_date').notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(), // active, completed, cancelled
  notes: varchar('notes', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
