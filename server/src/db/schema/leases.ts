import { pgTable, uuid, varchar, numeric, date, timestamp, text } from 'drizzle-orm/pg-core';
import { apartments } from './apartments.js';
import { organizations } from './organizations.js';

export const leases = pgTable('leases', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  apartmentId: uuid('apartment_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  tenantName: varchar('tenant_name', { length: 255 }).notNull(),
  tenantEmail: varchar('tenant_email', { length: 255 }),
  tenantPhone: varchar('tenant_phone', { length: 50 }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  monthlyRent: numeric('monthly_rent', { precision: 12, scale: 2 }).notNull(),
  securityDeposit: numeric('security_deposit', { precision: 12, scale: 2 }).default('0'),
  terms: text('terms'),
  contractDocumentUrl: varchar('contract_document_url', { length: 500 }),
  status: varchar('status', { length: 50 }).default('active').notNull(), // active, expired, terminated
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
