
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  ic_passport TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  race TEXT NOT NULL DEFAULT '',
  nationality TEXT NOT NULL DEFAULT '',
  occupation TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  monthly_salary NUMERIC NOT NULL DEFAULT 0,
  emergency_1_name TEXT NOT NULL DEFAULT '',
  emergency_1_phone TEXT NOT NULL DEFAULT '',
  emergency_1_relationship TEXT NOT NULL DEFAULT '',
  emergency_2_name TEXT NOT NULL DEFAULT '',
  emergency_2_phone TEXT NOT NULL DEFAULT '',
  emergency_2_relationship TEXT NOT NULL DEFAULT '',
  car_plate TEXT NOT NULL DEFAULT '',
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins boss manager can manage tenants"
ON public.tenants
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Agents can read tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'agent'::app_role));
