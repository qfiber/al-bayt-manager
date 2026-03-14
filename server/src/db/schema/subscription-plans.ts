import { pgTable, uuid, varchar, numeric, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(), // Starter, Medium, Pro, Enterprise
  slug: varchar('slug', { length: 50 }).notNull().unique(), // starter, medium, pro, enterprise
  maxBuildings: integer('max_buildings').notNull(),
  maxApartmentsPerBuilding: integer('max_apartments_per_building').notNull(),
  monthlyPrice: numeric('monthly_price', { precision: 10, scale: 2 }).notNull().default('0'),
  semiAnnualPrice: numeric('semi_annual_price', { precision: 10, scale: 2 }), // 6-month price
  yearlyPrice: numeric('yearly_price', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 10 }).default('ILS').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isCustom: boolean('is_custom').default(false).notNull(), // true for enterprise
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
