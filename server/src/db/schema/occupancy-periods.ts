import { pgTable, uuid, varchar, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { apartments } from './apartments.js';
import { profiles } from './profiles.js';
import { occupancyPeriodStatusEnum } from './enums.js';

export const occupancyPeriods = pgTable('occupancy_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  apartmentId: uuid('apartment_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').references(() => profiles.id, { onDelete: 'set null' }),
  tenantName: varchar('tenant_name', { length: 255 }),
  status: occupancyPeriodStatusEnum('status').notNull().default('active'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  closingBalance: numeric('closing_balance', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('occupancy_periods_apartment_id_idx').on(table.apartmentId),
]);
