import { pgTable, uuid, varchar, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  subdomain: varchar('subdomain', { length: 100 }).unique(),
  isActive: boolean('is_active').default(true).notNull(),
  defaultLanguage: varchar('default_language', { length: 10 }).default('ar').notNull(),
  maxBuildings: integer('max_buildings').default(0).notNull(), // 0 = unlimited
  maxApartments: integer('max_apartments').default(0).notNull(),
  onlinePaymentsEnabled: boolean('online_payments_enabled').default(false).notNull(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
