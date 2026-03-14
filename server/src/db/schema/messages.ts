import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subject: varchar('subject', { length: 255 }).notNull(),
  body: text('body').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  parentId: uuid('parent_id'), // for replies
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
