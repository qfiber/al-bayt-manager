import { pgTable, uuid, varchar, numeric, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { apartments } from './apartments.js';
import { buildings } from './buildings.js';

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  apartmentId: uuid('apartment_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  buildingId: uuid('building_id').notNull().references(() => buildings.id, { onDelete: 'cascade' }),
  month: varchar('month', { length: 7 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  items: jsonb('items').notNull().default([]),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_invoices_apartment_id').on(table.apartmentId),
  index('idx_invoices_apartment_month').on(table.apartmentId, table.month),
]);
