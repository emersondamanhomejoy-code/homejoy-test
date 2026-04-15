
-- 1. Add move-in related fields to bookings table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS order_status text NOT NULL DEFAULT 'booking_submitted',
  ADD COLUMN IF NOT EXISTS agreement_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS receipt_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS move_in_agent_id uuid,
  ADD COLUMN IF NOT EXISTS move_in_reject_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS move_in_cancel_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS move_in_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS move_in_reviewed_at timestamptz;

-- 2. Add archived_reason to rooms table
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS archived_reason text NOT NULL DEFAULT '';

-- 3. Migrate existing booking data to order_status
-- Simple statuses first
UPDATE public.bookings SET order_status = 'booking_submitted' WHERE status = 'submitted';
UPDATE public.bookings SET order_status = 'booking_rejected' WHERE status = 'rejected';
UPDATE public.bookings SET order_status = 'booking_cancelled' WHERE status = 'cancelled';

-- For approved bookings, check related move_ins
UPDATE public.bookings b SET
  order_status = CASE
    WHEN mi.status = 'submitted' THEN 'move_in_submitted'
    WHEN mi.status = 'approved' THEN 'move_in_approved'
    WHEN mi.status = 'rejected' THEN 'move_in_rejected'
    WHEN mi.status = 'reversed' THEN 'move_in_approved'
    ELSE 'booking_approved'
  END,
  agreement_signed = COALESCE(mi.agreement_signed, false),
  payment_method = COALESCE(mi.payment_method, ''),
  receipt_path = COALESCE(mi.receipt_path, ''),
  move_in_agent_id = mi.agent_id,
  move_in_reject_reason = COALESCE(mi.reject_reason, ''),
  move_in_cancel_reason = COALESCE(mi.cancel_reason, ''),
  move_in_reviewed_by = mi.reviewed_by,
  move_in_reviewed_at = mi.reviewed_at
FROM public.move_ins mi
WHERE mi.booking_id = b.id
  AND b.status = 'approved';

-- For approved bookings with no move_in record, set to booking_approved
UPDATE public.bookings SET order_status = 'booking_approved'
WHERE status = 'approved' AND order_status = 'booking_submitted';

-- 4. Add constraint for order_status values
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_order_status_check
  CHECK (order_status IN ('booking_submitted', 'booking_rejected', 'booking_approved', 'booking_cancelled', 'move_in_submitted', 'move_in_rejected', 'move_in_approved'));
