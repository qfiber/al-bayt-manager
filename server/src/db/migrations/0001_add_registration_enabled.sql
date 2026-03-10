ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "registration_enabled" boolean DEFAULT true NOT NULL;
