
CREATE TABLE public.claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  bank_name TEXT NOT NULL DEFAULT '',
  bank_account TEXT NOT NULL DEFAULT '',
  account_holder TEXT NOT NULL DEFAULT '',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- Agents can read their own claims
CREATE POLICY "Agents can read own claims"
  ON public.claims FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

-- Agents can create their own claims
CREATE POLICY "Agents can create claims"
  ON public.claims FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'agent') AND agent_id = auth.uid());

-- Admins can manage all claims
CREATE POLICY "Admins can manage claims"
  ON public.claims FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
