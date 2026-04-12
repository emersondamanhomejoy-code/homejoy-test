
ALTER TABLE public.condos
  ADD COLUMN IF NOT EXISTS access_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS visitor_car_parking text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS visitor_motorcycle_parking text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS arrival_instruction text NOT NULL DEFAULT '';
