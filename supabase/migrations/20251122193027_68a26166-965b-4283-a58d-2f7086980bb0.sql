-- Update payments table policies for moderators
DROP POLICY IF EXISTS "Admins can manage payments" ON payments;

CREATE POLICY "Admins and moderators can view payments"
ON payments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can add payments"
ON payments
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can update payments"
ON payments
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Only admins can delete payments"
ON payments
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update expenses table policies for moderators
DROP POLICY IF EXISTS "Admins can manage expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;

CREATE POLICY "Admins and moderators can view expenses"
ON expenses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can add expenses"
ON expenses
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can update expenses"
ON expenses
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Only admins can delete expenses"
ON expenses
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));