---
name: Core Business Flow
description: End-to-end pipeline from property setup to tenant move-out, using unified Order Status
type: feature
---
## Flow Sequence
1. **Location** — Area/region created
2. **Building** — Condo/building added under a location
3. **Unit** — Unit created under a building
4. **Room or Carpark** — Rooms/carparks added under a unit
5. **Booking** — Agent/customer submits booking (order_status = booking_submitted)
6. **Booking Approval** — Admin approves (order_status = booking_approved, room → Pending)
7. **Move-In Submission** — Agent brings tenant, submits confirmation (order_status = move_in_submitted)
8. **Move-In Approval** — Admin confirms (order_status = move_in_approved, room → Occupied)
9. **Earnings / Payouts** — Commission/payout generated for agent
10. **Move Out** — Tenant leaves, room released back to Available
