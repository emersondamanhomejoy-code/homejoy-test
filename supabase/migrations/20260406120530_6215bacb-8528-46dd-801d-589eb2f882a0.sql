ALTER TABLE public.units ADD COLUMN deposit_multiplier numeric NOT NULL DEFAULT 1.5;
ALTER TABLE public.units ADD COLUMN admin_fee numeric NOT NULL DEFAULT 330;