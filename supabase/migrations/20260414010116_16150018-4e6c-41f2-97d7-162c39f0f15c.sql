
CREATE TABLE public.move_outs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_name text NOT NULL DEFAULT '',
  tenant_id uuid,
  asset_type text NOT NULL DEFAULT 'Room',
  building text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  room text NOT NULL DEFAULT '',
  room_id uuid,
  move_out_type text NOT NULL DEFAULT '',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  next_status text NOT NULL DEFAULT 'Available',
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.move_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Super Admin can manage move_outs"
  ON public.move_outs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Agents can read move_outs"
  ON public.move_outs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'agent'::app_role));
