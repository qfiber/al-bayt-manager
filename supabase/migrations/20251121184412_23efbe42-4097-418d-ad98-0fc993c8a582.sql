-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Everyone can view settings" ON settings;

-- Create a new permissive policy that allows anyone (including anonymous users) to read settings
CREATE POLICY "Allow anonymous read access to settings"
ON settings
FOR SELECT
TO anon, authenticated
USING (true);