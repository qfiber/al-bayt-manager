-- Add org limits and language
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_language VARCHAR(10) NOT NULL DEFAULT 'ar';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_buildings INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_apartments INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_tenants INTEGER NOT NULL DEFAULT 0;

-- Remove owner_id and beneficiary_id from apartments (simplify to tenant only)
ALTER TABLE apartments DROP COLUMN IF EXISTS owner_id;
ALTER TABLE apartments DROP COLUMN IF EXISTS beneficiary_id;
