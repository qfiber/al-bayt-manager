-- Add Stripe payment gateway fields
ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_publishable_key VARCHAR(500);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_secret_key VARCHAR(500);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_webhook_secret VARCHAR(500);

-- Add CardCom payment gateway fields
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cardcom_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cardcom_terminal_number VARCHAR(50);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cardcom_api_name VARCHAR(255);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cardcom_api_password VARCHAR(500);

-- Add email verification setting
ALTER TABLE settings ADD COLUMN IF NOT EXISTS email_verification_enabled BOOLEAN NOT NULL DEFAULT false;
