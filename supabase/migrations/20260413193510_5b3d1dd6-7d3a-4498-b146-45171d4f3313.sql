-- Add room_title column to rooms table
ALTER TABLE public.rooms ADD COLUMN room_title text NOT NULL DEFAULT '';
