import { pgTable, uuid, numeric, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { apartments } from './apartments.js';
import { users } from './users.js';
import { ledgerEntryTypeEnum, ledgerReferenceTypeEnum } from './enums.js';

export const apartmentLedger = pgTable('apartment_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  apartmentId: uuid('apartment_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  entryType: ledgerEntryTypeEnum('entry_type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  referenceType: ledgerReferenceTypeEnum('reference_type').notNull(),
  referenceId: uuid('reference_id'),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('apartment_ledger_apartment_id_created_at_idx').on(table.apartmentId, table.createdAt),
]);
