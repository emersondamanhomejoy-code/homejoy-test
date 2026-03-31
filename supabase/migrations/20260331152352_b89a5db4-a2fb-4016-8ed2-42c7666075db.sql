
DO $$
DECLARE
  unit_record RECORD;
  new_unit_id UUID;
  room_names TEXT[] := ARRAY['Room A','Room B','Room C','Room D','Room E'];
  room_name TEXT;
BEGIN
  -- Define the 9 units to create
  FOR unit_record IN
    SELECT * FROM (VALUES
      ('Pantai Hill Park', '5-5-7', 'Pantai'),
      ('Pantai Hill Park', '5-6-7', 'Pantai'),
      ('Daman', 'D-2-11', 'Ara Damansara'),
      ('Casa Tiara', 'D-11-5', 'Subang'),
      ('Puncak Damansara', 'A-10-6', 'Damansara'),
      ('Daman Crimson', 'Y-15-10', 'Ara Damansara'),
      ('Casa Tiara', 'A-7-7', 'Subang'),
      ('Casa Subang', 'A-5-2', 'Subang'),
      ('Casa Subang', 'B-18-3', 'Subang')
    ) AS t(building, unit, location)
  LOOP
    -- Insert unit
    INSERT INTO public.units (building, unit, location, unit_type, unit_max_pax)
    VALUES (unit_record.building, unit_record.unit, unit_record.location, 'Mix Unit', 6)
    RETURNING id INTO new_unit_id;

    -- Insert 5 rooms for each unit
    FOREACH room_name IN ARRAY room_names
    LOOP
      INSERT INTO public.rooms (
        unit_id, building, unit, room, location, rent, bed_type, room_type,
        unit_type, status, available_date, max_pax, occupied_pax, pax_staying,
        unit_max_pax, unit_occupied_pax, housemates, photos, access_info,
        move_in_cost, tenant_gender, tenant_race
      ) VALUES (
        new_unit_id, unit_record.building, unit_record.unit, room_name,
        unit_record.location, 0, '', 'Medium Room', 'Mix Unit', 'Available',
        'Available Now', 1, 0, 0, 6, 0, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb,
        '{"advance":0,"deposit":0,"accessCard":0,"moveInFee":0,"total":0}'::jsonb,
        '', ''
      );
    END LOOP;
  END LOOP;
END $$;
