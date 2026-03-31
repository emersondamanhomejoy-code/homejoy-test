
-- Create rooms table
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building TEXT NOT NULL,
  unit TEXT NOT NULL,
  room TEXT NOT NULL,
  location TEXT NOT NULL,
  rent NUMERIC NOT NULL DEFAULT 0,
  room_type TEXT NOT NULL DEFAULT 'Medium Room',
  unit_type TEXT NOT NULL DEFAULT 'Mix Unit',
  status TEXT NOT NULL DEFAULT 'Available',
  available_date TEXT NOT NULL DEFAULT 'Available Now',
  max_pax INTEGER NOT NULL DEFAULT 1,
  occupied_pax INTEGER NOT NULL DEFAULT 0,
  unit_max_pax INTEGER NOT NULL DEFAULT 6,
  unit_occupied_pax INTEGER NOT NULL DEFAULT 0,
  housemates JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  access_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  move_in_cost JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read rooms
CREATE POLICY "Authenticated users can read rooms" ON public.rooms
  FOR SELECT TO authenticated USING (true);

-- Admins can manage rooms
CREATE POLICY "Admins can manage rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
