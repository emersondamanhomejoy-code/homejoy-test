
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Tenant basic info
  tenant_name text NOT NULL,
  tenant_phone text NOT NULL,
  tenant_email text NOT NULL DEFAULT '',
  tenant_ic_passport text NOT NULL DEFAULT '',
  tenant_gender text NOT NULL DEFAULT '',
  tenant_race text NOT NULL DEFAULT '',
  tenant_nationality text NOT NULL DEFAULT '',
  move_in_date date NOT NULL,
  contract_months integer NOT NULL DEFAULT 12,
  
  -- Work info
  company text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  monthly_salary numeric NOT NULL DEFAULT 0,
  
  -- Emergency contact
  emergency_name text NOT NULL DEFAULT '',
  emergency_phone text NOT NULL DEFAULT '',
  emergency_relationship text NOT NULL DEFAULT '',
  
  -- Photos / documents
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Who submitted
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_type text NOT NULL DEFAULT 'agent' CHECK (submitted_by_type IN ('agent', 'customer')),
  
  -- Admin action
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamp with time zone,
  reject_reason text NOT NULL DEFAULT '',
  
  -- Move-in cost snapshot
  move_in_cost jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Agents can read all bookings and create new ones
CREATE POLICY "Agents can read bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'agent'::app_role));

CREATE POLICY "Agents can create bookings" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'agent'::app_role) AND submitted_by = auth.uid());
