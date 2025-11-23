-- Drop the overly permissive authentication policy
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;

-- Update the admin policy to include moderators
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins and moderators can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
);