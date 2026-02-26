import { pgTable, uuid, varchar, integer, numeric, timestamp } from 'drizzle-orm/pg-core';

export const buildings = pgTable('buildings', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 500 }),
  numberOfFloors: integer('number_of_floors'),
  undergroundFloors: integer('underground_floors').default(0),
  monthlyFee: numeric('monthly_fee', { precision: 12, scale: 2 }).default('0'),
  logoUrl: varchar('logo_url', { length: 500 }),
  ntfyTopicUrl: varchar('ntfy_topic_url', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
