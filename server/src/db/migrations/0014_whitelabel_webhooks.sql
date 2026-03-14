-- White-label branding
ALTER TABLE settings ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#3b82f6';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#6366f1';

-- Webhooks
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  events VARCHAR(2000) NOT NULL DEFAULT '[]',
  secret VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhook_endpoints(organization_id);
