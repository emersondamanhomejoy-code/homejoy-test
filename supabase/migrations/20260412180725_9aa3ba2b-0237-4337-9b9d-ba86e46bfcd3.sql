
CREATE TABLE public.tenant_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  move_in_date DATE,
  contract_months INTEGER NOT NULL DEFAULT 12,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, room_id)
);

ALTER TABLE public.tenant_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins boss manager can manage tenant_rooms"
ON public.tenant_rooms
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Agents can read tenant_rooms"
ON public.tenant_rooms
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'agent'::app_role));
