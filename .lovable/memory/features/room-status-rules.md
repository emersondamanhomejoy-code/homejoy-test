---
name: Room Status Rules
description: Room creation always defaults to Available; Occupied status only via booking/move-in workflow
type: feature
---
- Room creation: NO status field shown, always defaults to "Available"
- Room edit: status dropdown shown but "Occupied" is disabled/read-only if already occupied
- Users cannot manually set a room to Occupied or assign tenants from room create/edit
- Tenant-room binding ONLY through: Booking → Approval → Move-in → Approval
- Carpark creation: same rules, always Available
- Carpark edit: same rules, Occupied is workflow-managed
