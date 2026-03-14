CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  max_buildings INTEGER NOT NULL,
  max_apartments_per_building INTEGER NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT '0',
  semi_annual_price NUMERIC(10,2),
  yearly_price NUMERIC(10,2),
  currency VARCHAR(10) NOT NULL DEFAULT 'ILS',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  status VARCHAR(30) NOT NULL DEFAULT 'trial',
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  amount NUMERIC(10,2),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'ILS',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  billing_cycle VARCHAR(20),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_subs_org ON organization_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_invoices_org ON subscription_invoices(organization_id);

-- Seed default plans
INSERT INTO subscription_plans (name, slug, max_buildings, max_apartments_per_building, monthly_price, semi_annual_price, yearly_price, display_order) VALUES
  ('Starter', 'starter', 1, 5, '99.00', '549.00', '999.00', 1),
  ('Medium', 'medium', 2, 5, '179.00', '999.00', '1799.00', 2),
  ('Pro', 'pro', 4, 7, '299.00', '1599.00', '2999.00', 3),
  ('Enterprise', 'enterprise', 0, 0, '0.00', NULL, NULL, 4)
ON CONFLICT (slug) DO NOTHING;

UPDATE subscription_plans SET is_custom = true WHERE slug = 'enterprise';

-- Create trial subscriptions for existing orgs without subscriptions
INSERT INTO organization_subscriptions (organization_id, plan_id, status, trial_start_date, trial_end_date)
SELECT o.id, (SELECT id FROM subscription_plans WHERE slug = 'starter'), 'trial', NOW(), NOW() + INTERVAL '30 days'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM organization_subscriptions os WHERE os.organization_id = o.id)
ON CONFLICT DO NOTHING;
