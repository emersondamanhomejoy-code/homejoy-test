
CREATE OR REPLACE FUNCTION public.check_role_type_uniqueness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_roles text[] := ARRAY['admin', 'super_admin'];
  agent_roles text[] := ARRAY['agent'];
  new_role_type text;
  existing_count int;
BEGIN
  -- Determine the type of the new role
  IF NEW.role::text = ANY(admin_roles) THEN
    new_role_type := 'admin';
    -- Check if user already has any admin-type role
    SELECT COUNT(*) INTO existing_count
    FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role::text = ANY(admin_roles)
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  ELSIF NEW.role::text = ANY(agent_roles) THEN
    new_role_type := 'agent';
    -- Check if user already has any agent-type role
    SELECT COUNT(*) INTO existing_count
    FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role::text = ANY(agent_roles)
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  ELSE
    -- boss, manager — treat each as its own type
    SELECT COUNT(*) INTO existing_count
    FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role = NEW.role
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    new_role_type := NEW.role::text;
  END IF;

  IF existing_count > 0 THEN
    RAISE EXCEPTION 'User already has a % role. Cannot have two roles of the same type.', new_role_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_role_type_uniqueness
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.check_role_type_uniqueness();
