import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const publicBranding = pgTable('public_branding', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyName: varchar('company_name', { length: 255 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  turnstileEnabled: boolean('turnstile_enabled').default(false),
  turnstileSiteKey: varchar('turnstile_site_key', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
