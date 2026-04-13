---
name: Booking Spec (Final)
description: Booking types, approval workflow (Pending+move-in+tenant), forfeit logic, filters, table columns
type: feature
---

## Booking Types
- room_only — Room Only
- room_carpark — Room + Carpark (max 2 carparks)
- carpark_only — Carpark Only (no room, no admin fee, no duration)

## Booking Statuses
submitted → approved / rejected / cancelled

## Approval Logic
1. Room + carparks → status becomes **Pending** (NOT Occupied)
2. Auto-create move-in record with status **ready_for_move_in**
3. Create formal tenant record (only on approval, not on submission)
4. Create tenant_rooms binding

## Rejection Logic
- Release room + carparks back to Available

## Cancel/Forfeit Logic
- If cancelling an **approved** booking → resolution_type = "forfeit"
- Release Pending room/carpark holds
- Cancel related move-in (ready_for_move_in → rejected)

## Tenant Creation Rules
- Only create tenant record when booking is **approved**
- If tenant already exists (by name+phone), update instead of duplicate
- If booking rejected/cancelled, do NOT create tenant

## Table Columns
Building, Unit, Room, Booking Type, Tenant Name, Exact Rental, Status, Agent, Submitted At, Last Updated, Actions

## Filters
- Status tabs (quick pills with counts): All, Submitted, Approved, Rejected, Cancelled
- Booking Type dropdown
- Agent multi-select
- Location, Building multi-select
- Date range

## Still TODO
- CreateBookingDialog: Add booking type selector with Carpark Only support
- BookingEditView: Add booking type field
- Carpark Only: skip room selection, admin fee, tenancy duration
