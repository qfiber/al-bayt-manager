import { pgTable, uuid, varchar, integer, numeric, timestamp, unique } from 'drizzle-orm/pg-core';
import { buildings } from './buildings.js';
import { profiles } from './profiles.js';

export const apartments = pgTable('apartments', {
  id: uuid('id').defaultRandom().primaryKey(),
  apartmentNumber: varchar('apartment_number', { length: 50 }).notNull(),
  floor: integer('floor'),
  buildingId: uuid('building_id').notNull().references(() => buildings.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).default('vacant').notNull(),
  cachedBalance: numeric('cached_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  subscriptionAmount: numeric('subscription_amount', { precision: 12, scale: 2 }).default('0'),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('inactive'),
  ownerId: uuid('owner_id').references(() => profiles.id, { onDelete: 'set null' }),
  beneficiaryId: uuid('beneficiary_id').references(() => profiles.id, { onDelete: 'set null' }),
  occupancyStart: timestamp('occupancy_start', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('apartments_building_id_apartment_number_unique').on(table.buildingId, table.apartmentNumber),
]);
