CREATE POLICY "Public can read rooms" ON public.rooms FOR SELECT TO anon USING (true);
CREATE POLICY "Public can read units" ON public.units FOR SELECT TO anon USING (true);