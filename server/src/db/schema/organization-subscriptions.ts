import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { subscriptionPlans } from './subscription-plans.js';

export const organizationSubscriptions = pgTable('organization_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').references(() => subscriptionPlans.id, { onDelete: 'set null' }),
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull().default('monthly'), // monthly, semi_annual, yearly
  status: varchar('status', { length: 30 }).notNull().default('trial'), // trial, active, past_due, cancelled, suspended
  trialStartDate: timestamp('trial_start_date', { withTimezone: true }),
  trialEndDate: timestamp('trial_end_date', { withTimezone: true }),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  amount: numeric('amount', { precision: 10, scale: 2 }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
