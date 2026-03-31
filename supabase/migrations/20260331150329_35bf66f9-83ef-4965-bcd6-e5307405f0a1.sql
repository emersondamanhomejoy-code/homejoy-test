
-- Update emergency contact fields
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_1_name text NOT NULL DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_1_phone text NOT NULL DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_1_relationship text NOT NULL DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_2_name text NOT NULL DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_2_phone text NOT NULL DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_2_relationship text NOT NULL DEFAULT '';

-- Change parking to number of parking lots
ALTER TABLE public.bookings ALTER COLUMN parking SET DEFAULT '0';

-- File upload paths
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS doc_passport jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS doc_offer_letter jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS doc_transfer_slip jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create storage bucket for booking documents
INSERT INTO storage.buckets (id, name, public) VALUES ('booking-docs', 'booking-docs', false) ON CONFLICT DO NOTHING;

-- RLS: authenticated users can upload to booking-docs
CREATE POLICY "Authenticated users can upload booking docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'booking-docs');

CREATE POLICY "Authenticated users can read booking docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'booking-docs');

CREATE POLICY "Admins can delete booking docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'booking-docs' AND (SELECT has_role(auth.uid(), 'admin'::app_role)));
