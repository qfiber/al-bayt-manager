import { pgTable, uuid, numeric, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  monthlyFee: numeric('monthly_fee', { precision: 12, scale: 2 }).default('0'),
  systemLanguage: varchar('system_language', { length: 10 }).default('ar'),
  logoUrl: varchar('logo_url', { length: 500 }),
  smtpEnabled: boolean('smtp_enabled').default(false),
  smtpFromEmail: varchar('smtp_from_email', { length: 255 }),
  smtpFromName: varchar('smtp_from_name', { length: 255 }),
  resendApiKey: varchar('resend_api_key', { length: 500 }),
  turnstileEnabled: boolean('turnstile_enabled').default(false),
  turnstileSiteKey: varchar('turnstile_site_key', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
