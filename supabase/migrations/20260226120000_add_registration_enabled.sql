ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN NOT NULL DEFAULT true;
