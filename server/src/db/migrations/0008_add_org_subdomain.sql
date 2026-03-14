ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subdomain VARCHAR(100) UNIQUE;

-- Backfill: generate subdomain from name for existing orgs
UPDATE organizations SET subdomain = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'))
WHERE subdomain IS NULL;
