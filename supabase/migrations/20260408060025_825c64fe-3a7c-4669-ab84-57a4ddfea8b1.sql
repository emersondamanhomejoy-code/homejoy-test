
-- Add boss and manager to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'boss';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
