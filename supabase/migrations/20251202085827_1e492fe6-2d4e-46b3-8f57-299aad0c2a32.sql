-- Create apartment_expenses table to track expense allocations to apartments
CREATE TABLE public.apartment_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  apartment_id UUID NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.apartment_expenses ENABLE ROW LEVEL SECURITY;

-- Admins and moderators can view all apartment expenses
CREATE POLICY "Admins and moderators can view apartment expenses"
ON public.apartment_expenses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'moderator'::app_role) 
    AND EXISTS (
      SELECT 1 FROM apartments 
      WHERE apartments.id = apartment_expenses.apartment_id 
      AND is_moderator_of_building(auth.uid(), apartments.building_id)
    )
  )
  OR EXISTS (
    SELECT 1 FROM user_apartments 
    WHERE user_apartments.apartment_id = apartment_expenses.apartment_id 
    AND user_apartments.user_id = auth.uid()
  )
);

-- Admins and moderators can insert apartment expenses
CREATE POLICY "Admins and moderators can insert apartment expenses"
ON public.apartment_expenses
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'moderator'::app_role) 
    AND EXISTS (
      SELECT 1 FROM apartments 
      WHERE apartments.id = apartment_expenses.apartment_id 
      AND is_moderator_of_building(auth.uid(), apartments.building_id)
    )
  )
);

-- Only admins can delete apartment expenses
CREATE POLICY "Only admins can delete apartment expenses"
ON public.apartment_expenses
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_apartment_expenses_apartment_id ON public.apartment_expenses(apartment_id);
CREATE INDEX idx_apartment_expenses_expense_id ON public.apartment_expenses(expense_id);