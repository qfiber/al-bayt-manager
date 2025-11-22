-- Remove Turnstile columns from settings table
ALTER TABLE public.settings 
  DROP COLUMN IF EXISTS turnstile_site_key,
  DROP COLUMN IF EXISTS turnstile_secret_key;