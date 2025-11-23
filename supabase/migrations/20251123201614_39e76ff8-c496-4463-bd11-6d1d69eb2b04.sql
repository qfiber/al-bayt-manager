-- Drop the current apartment viewing policy
DROP POLICY IF EXISTS "Apartment viewing policy" ON public.apartments;

-- Create a more restrictive policy that prevents users from viewing other apartments' financial data
CREATE POLICY "Apartment viewing policy"
ON public.apartments
FOR SELECT
USING (
  -- Admins and moderators can view all apartments and their financial data
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'moderator') OR
  -- Regular users can ONLY view apartments specifically assigned to them
  -- This prevents them from seeing neighbors' financial data
  EXISTS (
    SELECT 1 
    FROM user_apartments 
    WHERE user_apartments.apartment_id = apartments.id 
    AND user_apartments.user_id = auth.uid()
  )
);