-- Create moderator_buildings table for assigning moderators to buildings
CREATE TABLE public.moderator_buildings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, building_id)
);

-- Enable RLS
ALTER TABLE public.moderator_buildings ENABLE ROW LEVEL SECURITY;

-- Admins can manage moderator building assignments
CREATE POLICY "Admins can manage moderator buildings"
ON public.moderator_buildings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Moderators can view their own building assignments
CREATE POLICY "Moderators can view their assignments"
ON public.moderator_buildings
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_moderator_buildings_user_id ON public.moderator_buildings(user_id);
CREATE INDEX idx_moderator_buildings_building_id ON public.moderator_buildings(building_id);

-- Create helper function to check if user is moderator of a building
CREATE OR REPLACE FUNCTION public.is_moderator_of_building(_user_id uuid, _building_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.moderator_buildings
    WHERE user_id = _user_id AND building_id = _building_id
  )
$$;

-- Update apartments RLS policy for moderators to check building assignment
DROP POLICY IF EXISTS "Apartment viewing policy" ON public.apartments;
CREATE POLICY "Apartment viewing policy"
ON public.apartments
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'moderator'::app_role) AND is_moderator_of_building(auth.uid(), building_id))
  OR (EXISTS (
    SELECT 1
    FROM user_apartments
    WHERE user_apartments.apartment_id = apartments.id 
    AND user_apartments.user_id = auth.uid()
  ))
);

-- Update expenses RLS policies for moderators to check building assignment
DROP POLICY IF EXISTS "Admins and moderators can view expenses" ON public.expenses;
CREATE POLICY "Admins and moderators can view expenses"
ON public.expenses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'moderator'::app_role) AND is_moderator_of_building(auth.uid(), building_id))
);

DROP POLICY IF EXISTS "Admins and moderators can add expenses" ON public.expenses;
CREATE POLICY "Admins and moderators can add expenses"
ON public.expenses
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'moderator'::app_role) AND is_moderator_of_building(auth.uid(), building_id))
);

DROP POLICY IF EXISTS "Admins and moderators can update expenses" ON public.expenses;
CREATE POLICY "Admins and moderators can update expenses"
ON public.expenses
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'moderator'::app_role) AND is_moderator_of_building(auth.uid(), building_id))
);

-- Update payments RLS policies for moderators to check building assignment
DROP POLICY IF EXISTS "Admins and moderators can view payments" ON public.payments;
CREATE POLICY "Admins and moderators can view payments"
ON public.payments
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'moderator'::app_role) AND EXISTS (
    SELECT 1 FROM apartments 
    WHERE apartments.id = payments.apartment_id 
    AND is_moderator_of_building(auth.uid(), apartments.building_id)
  ))
  OR (EXISTS (
    SELECT 1
    FROM user_apartments
    WHERE user_apartments.apartment_id = payments.apartment_id 
    AND user_apartments.user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Admins and moderators can add payments" ON public.payments;
CREATE POLICY "Admins and moderators can add payments"
ON public.payments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'moderator'::app_role) AND EXISTS (
    SELECT 1 FROM apartments 
    WHERE apartments.id = payments.apartment_id 
    AND is_moderator_of_building(auth.uid(), apartments.building_id)
  ))
);

DROP POLICY IF EXISTS "Admins and moderators can update payments" ON public.payments;
CREATE POLICY "Admins and moderators can update payments"
ON public.payments
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'moderator'::app_role) AND EXISTS (
    SELECT 1 FROM apartments 
    WHERE apartments.id = payments.apartment_id 
    AND is_moderator_of_building(auth.uid(), apartments.building_id)
  ))
);