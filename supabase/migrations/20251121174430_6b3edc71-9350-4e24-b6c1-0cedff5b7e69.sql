-- Add subscription and credit columns to apartments
ALTER TABLE public.apartments
ADD COLUMN subscription_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN subscription_status text NOT NULL DEFAULT 'due',
ADD COLUMN credit numeric NOT NULL DEFAULT 0;

-- Remove occupancy_end from apartments
ALTER TABLE public.apartments
DROP COLUMN IF EXISTS occupancy_end;

-- Change payments month to text format and remove status
ALTER TABLE public.payments
ALTER COLUMN month TYPE text,
DROP COLUMN IF EXISTS status;

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for logo uploads (admins only)
CREATE POLICY "Admins can upload logos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'logos' AND auth.uid() IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
));

CREATE POLICY "Admins can update logos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'logos' AND auth.uid() IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
));

CREATE POLICY "Admins can delete logos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'logos' AND auth.uid() IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
));

CREATE POLICY "Everyone can view logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'logos');