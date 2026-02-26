import { pgTable, uuid, boolean, unique } from 'drizzle-orm/pg-core';
import { meetings } from './meetings.js';
import { users } from './users.js';

export const meetingAttendees = pgTable('meeting_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  attended: boolean('attended').notNull().default(false),
}, (table) => [
  unique('meeting_attendees_meeting_user_unique').on(table.meetingId, table.userId),
]);
