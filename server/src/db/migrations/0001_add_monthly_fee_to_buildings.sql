-- Move monthly_fee from settings to buildings table
ALTER TABLE buildings ADD COLUMN monthly_fee NUMERIC(12,2) DEFAULT '0';

-- Migrate existing global value to all buildings
UPDATE buildings SET monthly_fee = COALESCE((SELECT monthly_fee FROM settings LIMIT 1), '0');

-- Drop from settings
ALTER TABLE settings DROP COLUMN IF EXISTS monthly_fee;
