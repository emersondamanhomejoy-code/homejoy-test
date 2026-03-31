
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS occupation text NOT NULL DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pax_staying integer NOT NULL DEFAULT 1;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS access_card_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_contact_2 text NOT NULL DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS parking text NOT NULL DEFAULT 'No';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS car_plate text NOT NULL DEFAULT '';
