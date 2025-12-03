-- Add is_canceled column to payments to support payment cancellation tracking
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS is_canceled boolean NOT NULL DEFAULT false;