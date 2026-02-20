import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { apartments } from './apartments.js';

export const userApartments = pgTable('user_apartments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  apartmentId: uuid('apartment_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
