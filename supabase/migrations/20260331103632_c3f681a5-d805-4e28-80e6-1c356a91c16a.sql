
-- Create units table
CREATE TABLE public.units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building TEXT NOT NULL,
  unit TEXT NOT NULL,
  location TEXT NOT NULL,
  unit_type TEXT NOT NULL DEFAULT 'Mix Unit',
  unit_max_pax INTEGER NOT NULL DEFAULT 6,
  access_info JSONB NOT NULL DEFAULT '{"condoEntry":"","unitAccess":"","visitorParking":"","viewing":""}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unit_id to rooms
ALTER TABLE public.rooms ADD COLUMN unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE;

-- Enable RLS on units
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read units" ON public.units
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage units" ON public.units
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
