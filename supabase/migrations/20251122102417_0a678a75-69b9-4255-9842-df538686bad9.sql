-- Add Turnstile configuration to settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS turnstile_site_key TEXT,
ADD COLUMN IF NOT EXISTS turnstile_secret_key TEXT;

-- Add a comment explaining these fields
COMMENT ON COLUMN public.settings.turnstile_site_key IS 'Cloudflare Turnstile site key (public)';
COMMENT ON COLUMN public.settings.turnstile_secret_key IS 'Cloudflare Turnstile secret key (private)';