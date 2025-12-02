-- Add is_canceled column to apartment_expenses table
ALTER TABLE public.apartment_expenses 
ADD COLUMN is_canceled boolean NOT NULL DEFAULT false;

-- Update RLS policy to allow admins and moderators to update apartment expenses
CREATE POLICY "Admins and moderators can update apartment expenses"
ON public.apartment_expenses
FOR UPDATE
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
);