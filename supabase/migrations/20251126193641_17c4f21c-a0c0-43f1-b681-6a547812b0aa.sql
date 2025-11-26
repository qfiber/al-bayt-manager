-- Add owner and beneficiary to apartments table
ALTER TABLE public.apartments
ADD COLUMN owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN beneficiary_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_apartments_owner_id ON public.apartments(owner_id);
CREATE INDEX idx_apartments_beneficiary_id ON public.apartments(beneficiary_id);