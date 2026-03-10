import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const rateLimitEntries = pgTable('rate_limit_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 255 }).notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
