import { pgTable, uuid, varchar, integer, unique } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const documentSequences = pgTable('document_sequences', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  prefix: varchar('prefix', { length: 10 }).notNull(),
  year: integer('year').notNull(),
  lastNumber: integer('last_number').notNull().default(0),
}, (table) => [
  unique('document_sequences_prefix_year_unique').on(table.prefix, table.year),
]);
