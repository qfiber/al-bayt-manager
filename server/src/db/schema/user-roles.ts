import { pgTable, uuid, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { appRoleEnum } from './enums.js';

export const userRoles = pgTable('user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: appRoleEnum('role').notNull(),
}, (table) => [
  unique('user_roles_user_id_role_unique').on(table.userId, table.role),
]);
