---
name: Status System
description: Canonical status values for rooms, carparks, bookings, and move-ins with meanings
type: feature
---
## Room & Carpark Status
Available, Available Soon, Pending, Occupied, Archived

## Booking Status (DB column: `status`)
- **submitted** — Agent submitted, admin not yet reviewed
- **approved** — Booking passed review
- **rejected** — Admin rejected
- **cancelled** — Booking ended, will not continue

## Move-in Status (DB column: `status`)
- **ready_for_move_in** — Booking approved, waiting for agent to bring tenant
- **submitted** — Agent completed move-in IRL and submitted confirmation to admin
- **approved** — Admin confirmed move-in → active occupancy & payout item
- **rejected** — Admin did not accept the submission
- **reversed** — Already approved move-in found incorrect, revoked (error correction, NOT normal move-out)

## DB Constraints
- `bookings_status_check`: submitted, approved, rejected, cancelled
- `move_ins_status_check`: ready_for_move_in, submitted, approved, rejected, reversed
