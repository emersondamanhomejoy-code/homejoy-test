
-- Migrate existing boss and manager roles to super_admin
UPDATE public.user_roles SET role = 'super_admin' WHERE role IN ('boss', 'manager');

-- activity_logs: only super_admin can read
DROP POLICY IF EXISTS "Boss and Manager can read activity logs" ON public.activity_logs;
CREATE POLICY "Super Admin can read activity logs"
ON public.activity_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- booking_signatures
DROP POLICY IF EXISTS "Admins boss manager can read all signatures" ON public.booking_signatures;
CREATE POLICY "Admins and Super Admin can read all signatures"
ON public.booking_signatures FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- bookings
DROP POLICY IF EXISTS "Admins boss manager can manage bookings" ON public.bookings;
CREATE POLICY "Admins and Super Admin can manage bookings"
ON public.bookings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- claim_items
DROP POLICY IF EXISTS "Admins boss manager can manage claim_items" ON public.claim_items;
CREATE POLICY "Admins and Super Admin can manage claim_items"
ON public.claim_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- claims
DROP POLICY IF EXISTS "Admins boss manager can manage claims" ON public.claims;
CREATE POLICY "Admins and Super Admin can manage claims"
ON public.claims FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- condos
DROP POLICY IF EXISTS "Admins boss manager can manage condos" ON public.condos;
CREATE POLICY "Admins and Super Admin can manage condos"
ON public.condos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- locations
DROP POLICY IF EXISTS "Admins boss manager can manage locations" ON public.locations;
CREATE POLICY "Admins and Super Admin can manage locations"
ON public.locations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- move_ins
DROP POLICY IF EXISTS "Admins boss manager can manage move_ins" ON public.move_ins;
CREATE POLICY "Admins and Super Admin can manage move_ins"
ON public.move_ins FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- profiles
DROP POLICY IF EXISTS "Admins boss manager can manage profiles" ON public.profiles;
CREATE POLICY "Admins and Super Admin can manage profiles"
ON public.profiles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- rooms
DROP POLICY IF EXISTS "Admins boss manager can manage rooms" ON public.rooms;
CREATE POLICY "Admins and Super Admin can manage rooms"
ON public.rooms FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- tenant_rooms
DROP POLICY IF EXISTS "Admins boss manager can manage tenant_rooms" ON public.tenant_rooms;
CREATE POLICY "Admins and Super Admin can manage tenant_rooms"
ON public.tenant_rooms FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- tenants
DROP POLICY IF EXISTS "Admins boss manager can manage tenants" ON public.tenants;
CREATE POLICY "Admins and Super Admin can manage tenants"
ON public.tenants FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- units
DROP POLICY IF EXISTS "Admins boss manager can manage units" ON public.units;
CREATE POLICY "Admins and Super Admin can manage units"
ON public.units FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Admins boss manager can manage roles" ON public.user_roles;
CREATE POLICY "Admins and Super Admin can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
