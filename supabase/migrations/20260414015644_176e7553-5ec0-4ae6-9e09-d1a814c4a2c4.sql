
CREATE POLICY "Agents can update own move_ins"
ON public.move_ins
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'agent'::app_role) AND agent_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'agent'::app_role) AND agent_id = auth.uid());
