-- Add authentication requirement policies to prevent anonymous access

-- Require authentication for profiles table
CREATE POLICY "Require authentication for profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Require authentication for api_keys table
CREATE POLICY "Require authentication for api_keys" 
ON public.api_keys 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Require authentication for apartments table
CREATE POLICY "Require authentication for apartments" 
ON public.apartments 
FOR SELECT 
USING (auth.uid() IS NOT NULL);