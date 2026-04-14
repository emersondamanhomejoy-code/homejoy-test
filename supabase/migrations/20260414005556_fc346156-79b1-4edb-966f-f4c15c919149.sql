
-- Add bank fields and emergency relationship to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_proof text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text NOT NULL DEFAULT '';

-- Announcements table
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  use_as_banner boolean NOT NULL DEFAULT false,
  use_as_popup boolean NOT NULL DEFAULT false,
  popup_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Super Admin can manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated users can read active announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (active = true);
