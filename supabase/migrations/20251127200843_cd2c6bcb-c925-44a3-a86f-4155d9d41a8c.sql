-- Add Turnstile CAPTCHA settings to settings table
ALTER TABLE public.settings 
ADD COLUMN turnstile_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN turnstile_site_key text;

-- Update public_branding table to include turnstile settings for public access
ALTER TABLE public.public_branding 
ADD COLUMN turnstile_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN turnstile_site_key text;

-- Create trigger to sync turnstile settings from settings to public_branding
CREATE OR REPLACE FUNCTION sync_turnstile_to_public_branding()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.public_branding 
  SET 
    turnstile_enabled = NEW.turnstile_enabled,
    turnstile_site_key = NEW.turnstile_site_key,
    updated_at = now()
  WHERE id = (SELECT id FROM public.public_branding LIMIT 1);
  
  -- If public_branding is empty, insert a row
  IF NOT FOUND THEN
    INSERT INTO public.public_branding (turnstile_enabled, turnstile_site_key)
    VALUES (NEW.turnstile_enabled, NEW.turnstile_site_key);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to settings table
CREATE TRIGGER sync_turnstile_settings
AFTER INSERT OR UPDATE OF turnstile_enabled, turnstile_site_key ON public.settings
FOR EACH ROW
EXECUTE FUNCTION sync_turnstile_to_public_branding();