
INSERT INTO storage.buckets (id, name, public) VALUES ('room-photos', 'room-photos', true);

CREATE POLICY "Authenticated users can upload room photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'room-photos');

CREATE POLICY "Anyone can view room photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'room-photos');

CREATE POLICY "Admins can delete room photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'room-photos' AND public.has_role(auth.uid(), 'admin'));
