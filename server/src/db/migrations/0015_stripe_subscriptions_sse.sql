ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
