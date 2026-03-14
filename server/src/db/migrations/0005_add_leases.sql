CREATE TABLE IF NOT EXISTS leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  tenant_name VARCHAR(255) NOT NULL,
  tenant_email VARCHAR(255),
  tenant_phone VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE,
  monthly_rent NUMERIC(12,2) NOT NULL,
  security_deposit NUMERIC(12,2) DEFAULT '0',
  terms TEXT,
  contract_document_url VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leases_org_id ON leases(organization_id);
CREATE INDEX IF NOT EXISTS idx_leases_apartment_id ON leases(apartment_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);
