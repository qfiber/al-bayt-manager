-- Drop the overly permissive authentication policy that allows all authenticated users to view all apartments
DROP POLICY IF EXISTS "Require authentication for apartments" ON public.apartments;

-- Drop the existing selective policy so we can replace it with a more comprehensive one
DROP POLICY IF EXISTS "Users can view their assigned apartments" ON public.apartments;

-- Create a new comprehensive policy for viewing apartments
CREATE POLICY "Apartment viewing policy"
ON public.apartments
FOR SELECT
USING (
  -- Admins and moderators can view all apartments
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'moderator') OR
  -- Users can view apartments assigned to them
  EXISTS (
    SELECT 1 
    FROM user_apartments 
    WHERE user_apartments.apartment_id = apartments.id 
    AND user_apartments.user_id = auth.uid()
  ) OR
  -- Users can view apartments in buildings where they have an apartment
  EXISTS (
    SELECT 1 
    FROM user_apartments ua
    JOIN apartments user_apt ON ua.apartment_id = user_apt.id
    WHERE ua.user_id = auth.uid() 
    AND user_apt.building_id = apartments.building_id
  )
);