import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const accountLockouts = pgTable('account_lockouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  failedAttempts: integer('failed_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastFailedAt: timestamp('last_failed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
