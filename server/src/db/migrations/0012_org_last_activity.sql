ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Backfill from audit logs
UPDATE organizations o SET last_activity_at = (
  SELECT MAX(al.created_at) FROM audit_logs al WHERE al.organization_id = o.id
);
