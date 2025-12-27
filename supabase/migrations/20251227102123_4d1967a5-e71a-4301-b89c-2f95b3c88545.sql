-- Create a table to track payment allocations to specific expenses
CREATE TABLE public.payment_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  apartment_expense_id UUID NOT NULL REFERENCES public.apartment_expenses(id) ON DELETE CASCADE,
  amount_allocated NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(payment_id, apartment_expense_id)
);

-- Enable RLS
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_allocations
CREATE POLICY "Admins and moderators can view payment allocations"
ON public.payment_allocations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Admins and moderators can insert payment allocations"
ON public.payment_allocations
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Admins and moderators can update payment allocations"
ON public.payment_allocations
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Only admins can delete payment allocations"
ON public.payment_allocations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add amount_paid column to apartment_expenses to track how much has been paid toward each expense
ALTER TABLE public.apartment_expenses 
ADD COLUMN amount_paid NUMERIC NOT NULL DEFAULT 0;