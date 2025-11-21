-- Add unique constraint to ensure one apartment can only be assigned to one user
ALTER TABLE public.user_apartments 
DROP CONSTRAINT IF EXISTS user_apartments_apartment_id_key;

ALTER TABLE public.user_apartments 
ADD CONSTRAINT user_apartments_apartment_id_key UNIQUE (apartment_id);