import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  events: varchar('events', { length: 2000 }).notNull().default('[]'), // JSON array of event names
  secret: varchar('secret', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
