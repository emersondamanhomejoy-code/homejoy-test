ALTER TABLE public.units ADD COLUMN deposit text NOT NULL DEFAULT '';
ALTER TABLE public.units ADD COLUMN meter_type text NOT NULL DEFAULT 'Postpaid';
ALTER TABLE public.units ADD COLUMN meter_rate numeric NOT NULL DEFAULT 0;