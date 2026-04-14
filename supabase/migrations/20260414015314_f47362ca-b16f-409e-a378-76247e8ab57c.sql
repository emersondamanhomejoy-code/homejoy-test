
CREATE OR REPLACE FUNCTION public.set_room_pending(room_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rooms
  SET status = 'Pending', updated_at = now()
  WHERE id = ANY(room_ids)
    AND status = 'Available';
END;
$$;
