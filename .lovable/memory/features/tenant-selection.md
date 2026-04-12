---
name: Tenant selection for rooms/carparks
description: When room/carpark status is Occupied, select tenant from approved bookings instead of manual entry
type: feature
---
- When agent submits a booking and it's approved, the tenant data is saved in the system.
- In Add/Edit Unit, when room or carpark status = Occupied, show a "Select Tenant" dropdown populated from approved bookings.
- Do NOT use hardcoded occupant snapshot fields (pax, nationality, gender) for manual entry.
- The occupant snapshot (pax staying, nationality, gender) should be displayed read-only from the selected tenant's booking data, only in view/detail screens — not in the Add Unit form itself.
