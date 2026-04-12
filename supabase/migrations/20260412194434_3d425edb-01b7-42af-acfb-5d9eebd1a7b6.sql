
-- Create move_ins table
CREATE TABLE public.move_ins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  agent_id uuid NOT NULL,
  tenant_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_review',
  agreement_signed boolean NOT NULL DEFAULT false,
  payment_method text NOT NULL DEFAULT '',
  receipt_path text NOT NULL DEFAULT '',
  reject_reason text NOT NULL DEFAULT '',
  cancel_reason text NOT NULL DEFAULT '',
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.move_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins boss manager can manage move_ins"
  ON public.move_ins FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Agents can read own move_ins"
  ON public.move_ins FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can create own move_ins"
  ON public.move_ins FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'agent'::app_role) AND agent_id = auth.uid());

-- Create claim_items table
CREATE TABLE public.claim_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  building text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  room text NOT NULL DEFAULT '',
  tenant_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins boss manager can manage claim_items"
  ON public.claim_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Agents can read own claim_items"
  ON public.claim_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.claims c WHERE c.id = claim_id AND c.agent_id = auth.uid()
  ));

-- Update claims table
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS payout_date date;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS cancel_reason text NOT NULL DEFAULT '';
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Update profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_picture_url text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ic_document text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_name text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone text NOT NULL DEFAULT '';
