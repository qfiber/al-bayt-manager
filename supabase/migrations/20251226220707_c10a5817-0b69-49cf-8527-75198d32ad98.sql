-- Add email settings columns to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS smtp_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS smtp_from_email text,
ADD COLUMN IF NOT EXISTS smtp_from_name text,
ADD COLUMN IF NOT EXISTS resend_api_key text;