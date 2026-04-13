
ALTER TABLE public.profiles
ADD COLUMN frozen boolean NOT NULL DEFAULT false,
ADD COLUMN frozen_at timestamp with time zone DEFAULT NULL;
