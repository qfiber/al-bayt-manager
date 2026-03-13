-- Create org_role enum
DO $$ BEGIN
  CREATE TYPE org_role AS ENUM ('org_admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role org_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_members_user_org_unique UNIQUE(user_id, organization_id)
);

-- Add is_super_admin to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Add organization_id to all directly-scoped tables (nullable initially for migration)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE general_information ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE document_sequences ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE debt_collection_stages ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to sms/ntfy tables if they exist
ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ntfy_templates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create default organization and backfill all existing data
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Create default org
  INSERT INTO organizations (name) VALUES ('Default Organization')
  ON CONFLICT DO NOTHING;

  SELECT id INTO default_org_id FROM organizations WHERE name = 'Default Organization';

  -- Backfill all tables
  UPDATE buildings SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE settings SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE general_information SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE audit_logs SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE api_keys SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE email_templates SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE email_logs SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE document_sequences SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE debt_collection_stages SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE sms_templates SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE sms_logs SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE ntfy_templates SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- Migrate existing user_roles into organization_members
  INSERT INTO organization_members (user_id, organization_id, role)
  SELECT ur.user_id, default_org_id,
    CASE ur.role::text
      WHEN 'admin' THEN 'org_admin'::org_role
      WHEN 'moderator' THEN 'moderator'::org_role
      ELSE 'user'::org_role
    END
  FROM user_roles ur
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  -- Mark existing admins as super_admin (first admin found)
  UPDATE users SET is_super_admin = true
  WHERE id IN (
    SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1
  );
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_buildings_org_id ON buildings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_settings_org_id ON settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_org_id ON email_templates(organization_id);
