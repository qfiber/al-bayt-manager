import { pgTable, uuid, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { meetingDecisionStatusEnum } from './enums.js';
import { meetings } from './meetings.js';
import { users } from './users.js';

export const meetingDecisions = pgTable('meeting_decisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  dueDate: date('due_date'),
  status: meetingDecisionStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_meeting_decisions_meeting_id').on(table.meetingId),
]);
