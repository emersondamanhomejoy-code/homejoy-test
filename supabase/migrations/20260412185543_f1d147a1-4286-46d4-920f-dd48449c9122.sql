
-- Add document columns to tenants table
ALTER TABLE public.tenants ADD COLUMN doc_passport jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.tenants ADD COLUMN doc_offer_letter jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.tenants ADD COLUMN doc_transfer_slip jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add tenancy start/end date columns to rooms table
ALTER TABLE public.rooms ADD COLUMN tenancy_start_date date;
ALTER TABLE public.rooms ADD COLUMN tenancy_end_date date;
