
CREATE POLICY "Agents can update own bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'agent'::app_role) AND submitted_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'agent'::app_role) AND submitted_by = auth.uid());
