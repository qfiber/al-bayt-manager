-- Remove the unique constraint that prevents multiple payments per apartment per month
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_apartment_id_month_key;