
-- Drop existing booking status constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Update bookings default and data
ALTER TABLE public.bookings ALTER COLUMN status SET DEFAULT 'submitted';
UPDATE public.bookings SET status = 'submitted' WHERE status = 'pending';

-- Add new booking status constraint
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('submitted', 'approved', 'rejected', 'cancelled'));

-- Drop existing move-in status constraint if any
ALTER TABLE public.move_ins DROP CONSTRAINT IF EXISTS move_ins_status_check;

-- Update move_ins default and data
ALTER TABLE public.move_ins ALTER COLUMN status SET DEFAULT 'submitted';
UPDATE public.move_ins SET status = 'submitted' WHERE status = 'pending_review';

-- Add new move-in status constraint
ALTER TABLE public.move_ins ADD CONSTRAINT move_ins_status_check CHECK (status IN ('ready_for_move_in', 'submitted', 'approved', 'rejected', 'reversed'));
