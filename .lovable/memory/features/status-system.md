---
name: Unified Status System
description: Order Status (7 states on bookings table) + Room Status (5 states on rooms table) — replaces old separate booking/move-in status
type: feature
---
## Order Status (DB column: `bookings.order_status`)
Single unified workflow variable on the bookings table:
- **booking_submitted** — Agent submitted, admin not yet reviewed
- **booking_approved** — Admin approved booking → room becomes Pending
- **booking_rejected** — Admin rejected booking
- **booking_cancelled** — Booking cancelled (forfeit if was approved)
- **move_in_submitted** — Agent completed move-in IRL, submitted confirmation
- **move_in_approved** — Admin confirmed move-in → room becomes Occupied
- **move_in_rejected** — Admin rejected the move-in submission

## Room Status (DB column: `rooms.status`)
Inventory/physical state of the room:
- **Available** — Empty, ready to book
- **Available Soon** — Occupied but will be available on a future date
- **Pending** — Booking approved, waiting for move-in
- **Occupied** — Tenant living in room
- **Archived** — Removed from inventory (requires archived_reason)

## Key Design Decisions
- Old `bookings.status` column is deprecated — use `order_status` instead
- Old `move_ins` table is deprecated — move-in data merged into bookings table
- Room status transitions are automated by order_status changes
- `archived_reason` field only shown/required when room status = Archived

## DB Constraints
- `bookings_order_status_check`: booking_submitted, booking_approved, booking_rejected, booking_cancelled, move_in_submitted, move_in_rejected, move_in_approved
