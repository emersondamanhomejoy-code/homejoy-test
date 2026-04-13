-- Add booking_type column
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS booking_type text NOT NULL DEFAULT 'room_only';

-- Add resolution_type column  
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS resolution_type text NOT NULL DEFAULT '';

-- Backfill existing bookings: if parking > 0, set to room_carpark
UPDATE public.bookings 
SET booking_type = 'room_carpark' 
WHERE parking IS NOT NULL AND parking != '' AND parking != '0' AND room_id IS NOT NULL;

-- If room_id is null, set to carpark_only (edge case)
UPDATE public.bookings 
SET booking_type = 'carpark_only' 
WHERE room_id IS NULL;