-- Fix user_roles: boss & manager can manage roles too
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins boss manager can manage roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Fix profiles: boss & manager can manage profiles too
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins boss manager can manage profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Fix bookings: boss & manager can manage bookings too
DROP POLICY IF EXISTS "Admins can manage bookings" ON public.bookings;
CREATE POLICY "Admins boss manager can manage bookings"
  ON public.bookings
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Fix claims: boss & manager can manage claims too
DROP POLICY IF EXISTS "Admins can manage claims" ON public.claims;
CREATE POLICY "Admins boss manager can manage claims"
  ON public.claims
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Fix rooms: boss & manager can manage rooms too
DROP POLICY IF EXISTS "Admins can manage rooms" ON public.rooms;
CREATE POLICY "Admins boss manager can manage rooms"
  ON public.rooms
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Fix units: boss & manager can manage units too
DROP POLICY IF EXISTS "Admins can manage units" ON public.units;
CREATE POLICY "Admins boss manager can manage units"
  ON public.units
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Fix booking_signatures: boss & manager can read all signatures too
DROP POLICY IF EXISTS "Admins can read all signatures" ON public.booking_signatures;
CREATE POLICY "Admins boss manager can read all signatures"
  ON public.booking_signatures
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'boss'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  );