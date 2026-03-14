CREATE TABLE IF NOT EXISTS payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL,
  installments INTEGER NOT NULL,
  amount_per_installment NUMERIC(12,2) NOT NULL,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_org ON payment_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_apt ON payment_plans(apartment_id);

CREATE TABLE IF NOT EXISTS building_handbook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handbook_org ON building_handbook(organization_id);
CREATE INDEX IF NOT EXISTS idx_handbook_building ON building_handbook(building_id);
