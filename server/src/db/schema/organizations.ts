import { pgTable, uuid, varchar, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  defaultLanguage: varchar('default_language', { length: 10 }).default('ar').notNull(),
  maxBuildings: integer('max_buildings').default(0).notNull(), // 0 = unlimited
  maxApartments: integer('max_apartments').default(0).notNull(),
  maxTenants: integer('max_tenants').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
