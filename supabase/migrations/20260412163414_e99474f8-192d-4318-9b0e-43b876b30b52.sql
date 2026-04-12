
-- Add new columns to rooms table for expanded room/carpark features
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS room_category text NOT NULL DEFAULT 'Normal Room';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS optional_features jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS internal_remark text NOT NULL DEFAULT '';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS assigned_to text NOT NULL DEFAULT '';
