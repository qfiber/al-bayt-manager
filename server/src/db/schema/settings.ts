import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyName: varchar('company_name', { length: 255 }),
  systemLanguage: varchar('system_language', { length: 10 }).default('ar').notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  smtpEnabled: boolean('smtp_enabled').default(false).notNull(),
  smtpFromEmail: varchar('smtp_from_email', { length: 255 }),
  smtpFromName: varchar('smtp_from_name', { length: 255 }),
  resendApiKey: varchar('resend_api_key', { length: 500 }),
  turnstileEnabled: boolean('turnstile_enabled').default(false).notNull(),
  turnstileSiteKey: varchar('turnstile_site_key', { length: 255 }),
  turnstileSecretKey: varchar('turnstile_secret_key', { length: 255 }),
  ntfyEnabled: boolean('ntfy_enabled').default(false).notNull(),
  ntfyServerUrl: varchar('ntfy_server_url', { length: 500 }),
  currencyCode: varchar('currency_code', { length: 10 }).default('ILS').notNull(),
  currencySymbol: varchar('currency_symbol', { length: 10 }).default('₪').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
