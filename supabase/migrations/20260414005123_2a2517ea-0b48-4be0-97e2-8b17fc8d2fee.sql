
-- Earnings table: one record per valid deal commission
CREATE TABLE public.earnings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  booking_id uuid REFERENCES public.bookings(id),
  move_in_id uuid REFERENCES public.move_ins(id),
  room_id uuid REFERENCES public.rooms(id),
  tenant_name text NOT NULL DEFAULT '',
  building text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  room text NOT NULL DEFAULT '',
  exact_rental numeric NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'internal_basic',
  commission_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  pay_cycle text NOT NULL DEFAULT '',
  payout_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Super Admin can manage earnings"
  ON public.earnings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Agents can read own earnings"
  ON public.earnings FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- Payouts table: monthly batch payout per agent
CREATE TABLE public.payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  agent_name text NOT NULL DEFAULT '',
  deal_count integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  pay_cycle text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  generated_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  paid_at timestamp with time zone,
  notes text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Super Admin can manage payouts"
  ON public.payouts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Agents can read own payouts"
  ON public.payouts FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- Add foreign key from earnings to payouts
ALTER TABLE public.earnings ADD CONSTRAINT earnings_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.payouts(id);
