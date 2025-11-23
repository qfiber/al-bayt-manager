-- Create public_branding table for publicly accessible branding assets
CREATE TABLE public.public_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on public_branding
ALTER TABLE public.public_branding ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access to public_branding
CREATE POLICY "Allow anonymous read access to public_branding"
ON public.public_branding
FOR SELECT
USING (true);

-- Allow admins to update public_branding
CREATE POLICY "Admins can update public_branding"
ON public.public_branding
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to insert public_branding
CREATE POLICY "Admins can insert public_branding"
ON public.public_branding
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Copy existing logo from settings to public_branding
INSERT INTO public.public_branding (logo_url, company_name)
SELECT logo_url, 'qFiber LTD'
FROM public.settings
LIMIT 1;

-- Drop the anonymous access policy from settings
DROP POLICY IF EXISTS "Allow anonymous read access to settings" ON public.settings;

-- Create authenticated-only read policy for settings
CREATE POLICY "Authenticated users can read settings"
ON public.settings
FOR SELECT
USING (auth.uid() IS NOT NULL);