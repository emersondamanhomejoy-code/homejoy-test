---
name: Room Status Rules (Final)
description: Complete room status transition logic — which statuses are editable, read-only, or workflow-controlled
type: feature
---

## Status Values
Available, Available Soon, Pending, Occupied, Archived

## Create Room
- NO status field shown, always defaults to "Available"
- NO tenant assignment from room create

## Edit Room Status Dropdown Rules

| Current Status | Allowed Transitions | Notes |
|---|---|---|
| Available | Available, Archived | Cannot go to Available Soon (room is empty) |
| Occupied | Occupied, Available Soon | Available Soon requires Available Date |
| Available Soon | READ-ONLY | Release via Move Out workflow only |
| Pending | READ-ONLY | Controlled by Booking workflow |
| Archived | Archived, Available | Restore to inventory |

## Workflow-Controlled Transitions
- Booking Approved → room becomes Pending
- Move In Approved → room becomes Occupied
- Occupied → Available Soon: manual in Edit Room, requires Available Date
- Move Out completed → room becomes Available

## Key Principles
- Available Soon = still occupied, but expected to become vacant on a future date
- Pending and Available Soon are never manually editable
- Occupied cannot be freely switched to Available — must go through Move Out
- Same rules apply to Carparks
