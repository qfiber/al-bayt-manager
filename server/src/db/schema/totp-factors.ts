import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { totpStatusEnum } from './enums.js';

export const totpFactors = pgTable('totp_factors', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  secret: varchar('secret', { length: 255 }).notNull(),
  friendlyName: varchar('friendly_name', { length: 255 }),
  status: totpStatusEnum('status').default('unverified').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
