CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'inspection',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration VARCHAR(50) DEFAULT '60',
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  notify_email VARCHAR(10) NOT NULL DEFAULT 'true',
  notify_sms VARCHAR(10) NOT NULL DEFAULT 'true',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspections_org_id ON inspections(organization_id);
CREATE INDEX IF NOT EXISTS idx_inspections_building_id ON inspections(building_id);
CREATE INDEX IF NOT EXISTS idx_inspections_scheduled ON inspections(scheduled_at);
