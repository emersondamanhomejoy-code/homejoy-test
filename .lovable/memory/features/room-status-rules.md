---
name: Room Status Transition Rules
description: Complete room status lifecycle — valid transitions, where they happen, and enforcement rules
type: feature
---

## Statuses
Available, Available Soon, Pending, Occupied, Archived

## Valid Transitions

| From | To | Where |
|------|-----|-------|
| Available | Archived | Edit Unit & Room (requires Archived Reason) |
| Available | Pending | Auto when booking submitted |
| Available | Available Soon | Edit Unit & Room |
| Available Soon | Pending | Auto when booking submitted |
| Pending | Available | Admin Booking page (reject) |
| Pending | Occupied | Admin Booking page (approve) |
| Occupied | Available | Move-out page |
| Occupied | Available Soon | Move-out page |
| Occupied | Archived | Move-out page |
| Archived | Available | Edit Unit & Room |

## Edit Page Status Dropdown

| Current Status | Dropdown Options | Notes |
|---|---|---|
| Available | Available, Available Soon, Archived | Archived requires reason |
| Available Soon | Available Soon, Available | Admin can undo |
| Pending | READ-ONLY | Controlled by Booking workflow |
| Occupied | READ-ONLY | Controlled by Move Out workflow |
| Archived | Archived, Available | Restore to inventory |

## Enforcement Rules
- Status field is NOT freely editable
- Pending: must handle via Admin Booking page — no manual status change
- Occupied: must use Move-out page — no manual status change
- Archived Reason field required when changing to Archived, displayed in View Room only when Archived
- Available Soon rooms are bookable (same as Available for agents)
- Same rules apply to Carparks
