---
name: Booking Spec (Unified)
description: Booking types, unified order_status workflow, move-in merged into bookings table
type: feature
---

## Booking Types
- room_only — Room Only
- room_carpark — Room + Carpark (max 2 carparks)
- carpark_only — Carpark Only (no room, no admin fee, no duration)

## Order Status (unified workflow)
booking_submitted → booking_approved / booking_rejected / booking_cancelled
booking_approved → move_in_submitted
move_in_submitted → move_in_approved / move_in_rejected

## Approval Logic (booking_approved)
1. Room + carparks → status becomes **Pending** (NOT Occupied)
2. Create formal tenant record (only on approval)
3. Create tenant_rooms binding

## Move-In Fields (merged into bookings table)
- agreement_signed, payment_method, receipt_path
- move_in_agent_id, move_in_reviewed_by, move_in_reviewed_at
- move_in_reject_reason, move_in_cancel_reason

## Rejection Logic
- Release room + carparks back to Available

## Cancel/Forfeit Logic
- If cancelling an **approved** booking → resolution_type = "forfeit"
- Release Pending room/carpark holds

## Tenant Creation Rules
- Only create tenant record when booking is **approved**
- If tenant already exists (by name+phone), update instead of duplicate
- If booking rejected/cancelled, do NOT create tenant

## Table Columns
Building, Unit, Room, Booking Type, Tenant Name, Exact Rental, Order Status, Agent, Submitted At, Last Updated, Actions

## Filters
- Status tabs (quick pills with counts): All, Booking Submitted, Booking Approved, Move-In Submitted, Move-In Approved, Rejected, Cancelled
- Booking Type dropdown
- Agent multi-select
- Location, Building multi-select
- Date range
