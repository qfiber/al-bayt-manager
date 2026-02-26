import { pgTable, uuid, varchar, date, text, timestamp, index } from 'drizzle-orm/pg-core';
import { buildings } from './buildings.js';
import { users } from './users.js';

export const meetings = pgTable('meetings', {
  id: uuid('id').defaultRandom().primaryKey(),
  buildingId: uuid('building_id').notNull().references(() => buildings.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  date: date('date').notNull(),
  location: varchar('location', { length: 500 }),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_meetings_building_id').on(table.buildingId),
]);
