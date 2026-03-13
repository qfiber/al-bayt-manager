import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const generalInformation = pgTable('general_information', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }),
  text1: varchar('text_1', { length: 1000 }),
  text2: varchar('text_2', { length: 1000 }),
  text3: varchar('text_3', { length: 1000 }),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
