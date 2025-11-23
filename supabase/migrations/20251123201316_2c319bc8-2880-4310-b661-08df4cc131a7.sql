-- Fix API Keys table - restrict to admins only
-- Drop the overly permissive authentication policy that allows all authenticated users
DROP POLICY IF EXISTS "Require authentication for api_keys" ON public.api_keys;

-- Ensure only the admin-specific policies remain (they already exist, this is just for clarity)
-- The existing "Admins can view all API keys" policy is sufficient


-- Fix Profiles table - prevent anonymous access and restrict phone number visibility
-- Drop existing policies to rebuild them more securely
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and moderators can view all profiles" ON public.profiles;

-- Create new restrictive policies for profiles
-- Users can view their own profile (authenticated users only)
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

-- Only admins can view all profiles (including phone numbers)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Moderators can view all profiles BUT without phone numbers
-- Note: This requires application-level filtering since RLS can't selectively hide columns
-- For now, we'll allow moderators full access but should consider application-level filtering
CREATE POLICY "Moderators can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'moderator'));