
CREATE TABLE public.booking_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  booking_data JSONB NOT NULL DEFAULT '{}',
  room_id UUID REFERENCES public.rooms(id),
  created_by UUID NOT NULL,
  tenant_name TEXT NOT NULL,
  signed BOOLEAN NOT NULL DEFAULT false,
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can create signatures"
ON public.booking_signatures FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'agent') AND created_by = auth.uid());

CREATE POLICY "Agents can read own signatures"
ON public.booking_signatures FOR SELECT TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Admins can read all signatures"
ON public.booking_signatures FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read by token for signing"
ON public.booking_signatures FOR SELECT TO anon
USING (true);

CREATE POLICY "Anyone can update signature by token"
ON public.booking_signatures FOR UPDATE TO anon
USING (signed = false)
WITH CHECK (signed = true);
