import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { buildings } from './buildings.js';
import { apartments } from './apartments.js';
import { organizations } from './organizations.js';

export const inspections = pgTable('inspections', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  buildingId: uuid('building_id').references(() => buildings.id, { onDelete: 'cascade' }),
  apartmentId: uuid('apartment_id').references(() => apartments.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull().default('inspection'), // inspection, maintenance, visit
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  duration: varchar('duration', { length: 50 }).default('60'), // minutes
  status: varchar('status', { length: 50 }).default('scheduled').notNull(), // scheduled, completed, cancelled
  notifyEmail: varchar('notify_email', { length: 10 }).default('true').notNull(), // 'true'/'false'
  notifySms: varchar('notify_sms', { length: 10 }).default('true').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
