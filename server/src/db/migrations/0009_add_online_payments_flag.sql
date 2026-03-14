ALTER TABLE organizations ADD COLUMN IF NOT EXISTS online_payments_enabled BOOLEAN NOT NULL DEFAULT false;
