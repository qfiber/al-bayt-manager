import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';
import { orgRoleEnum } from './enums.js';

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: orgRoleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('org_members_user_org_unique').on(table.userId, table.organizationId),
]);
