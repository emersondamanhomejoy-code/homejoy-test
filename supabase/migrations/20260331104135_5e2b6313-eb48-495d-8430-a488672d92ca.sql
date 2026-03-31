
-- Add tenant info to rooms
ALTER TABLE public.rooms ADD COLUMN bed_type TEXT NOT NULL DEFAULT '';
ALTER TABLE public.rooms ADD COLUMN pax_staying INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.rooms ADD COLUMN tenant_gender TEXT NOT NULL DEFAULT '';
ALTER TABLE public.rooms ADD COLUMN tenant_race TEXT NOT NULL DEFAULT '';

-- Add passcode and access card to units
ALTER TABLE public.units ADD COLUMN passcode TEXT NOT NULL DEFAULT '';
ALTER TABLE public.units ADD COLUMN access_card TEXT NOT NULL DEFAULT '';
ALTER TABLE public.units ADD COLUMN parking_rate TEXT NOT NULL DEFAULT '';
