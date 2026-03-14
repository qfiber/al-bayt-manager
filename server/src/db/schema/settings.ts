import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
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
  registrationEnabled: boolean('registration_enabled').default(true).notNull(),
  ntfyEnabled: boolean('ntfy_enabled').default(false).notNull(),
  ntfyServerUrl: varchar('ntfy_server_url', { length: 500 }),
  smsEnabled: boolean('sms_enabled').default(false).notNull(),
  smsProvider: varchar('sms_provider', { length: 50 }).default('019'),
  smsApiToken: varchar('sms_api_token', { length: 500 }),
  smsUsername: varchar('sms_username', { length: 255 }),
  smsSenderName: varchar('sms_sender_name', { length: 11 }),
  currencyCode: varchar('currency_code', { length: 10 }).default('ILS').notNull(),
  currencySymbol: varchar('currency_symbol', { length: 10 }).default('₪').notNull(),
  // Payment gateways (placeholder)
  stripeEnabled: boolean('stripe_enabled').default(false).notNull(),
  stripePublishableKey: varchar('stripe_publishable_key', { length: 500 }),
  stripeSecretKey: varchar('stripe_secret_key', { length: 500 }),
  stripeWebhookSecret: varchar('stripe_webhook_secret', { length: 500 }),
  cardcomEnabled: boolean('cardcom_enabled').default(false).notNull(),
  cardcomTerminalNumber: varchar('cardcom_terminal_number', { length: 50 }),
  cardcomApiName: varchar('cardcom_api_name', { length: 255 }),
  cardcomApiPassword: varchar('cardcom_api_password', { length: 500 }),
  // Email verification
  emailVerificationEnabled: boolean('email_verification_enabled').default(false).notNull(),
  // PayPal payment gateway
  paypalEnabled: boolean('paypal_enabled').default(false).notNull(),
  paypalClientId: varchar('paypal_client_id', { length: 500 }),
  paypalClientSecret: varchar('paypal_client_secret', { length: 500 }),
  paypalMode: varchar('paypal_mode', { length: 10 }).default('sandbox'), // sandbox or live
  // Twilio SMS
  twilioEnabled: boolean('twilio_enabled').default(false).notNull(),
  twilioAccountSid: varchar('twilio_account_sid', { length: 255 }),
  twilioAuthToken: varchar('twilio_auth_token', { length: 500 }),
  twilioPhoneNumber: varchar('twilio_phone_number', { length: 50 }),
  // EZCount invoicing
  ezCountApiKey: varchar('ez_count_api_key', { length: 500 }),
  ezCountApiEmail: varchar('ez_count_api_email', { length: 255 }),
  // HYP Payment Gateway
  hypEnabled: boolean('hyp_enabled').default(false).notNull(),
  hypMasof: varchar('hyp_masof', { length: 20 }),
  hypKey: varchar('hyp_key', { length: 255 }),
  hypPassP: varchar('hyp_passp', { length: 255 }),
  // Region setting for payment/SMS routing
  region: varchar('region', { length: 10 }).default('IL').notNull(), // IL = Israel, INTL = International
  // White-label branding
  primaryColor: varchar('primary_color', { length: 20 }).default('#3b82f6'),
  accentColor: varchar('accent_color', { length: 20 }).default('#6366f1'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
