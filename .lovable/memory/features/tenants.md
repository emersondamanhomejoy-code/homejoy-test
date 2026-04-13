---
name: Tenant page spec
description: Tenant table columns, detail sections, filters, occupancy display, booking history, no direct editing of bindings
type: feature
---

## Table Columns
Tenant Name, Contact, Gender, Nationality, Occupation, Active Rooms Count, Active Carparks Count, Total Bookings, Actions

## Filters
Default: Search (name/email/phone), Nationality, Gender
Advanced: Occupation, Has Active Rooms, Has Active Carparks, Building

## Detail Sections (accordion)
1. Personal Info (name, IC, email, phone, gender, nationality, occupation)
2. Emergency Contacts (2 entries: name, phone, relationship)
3. Documents (Passport/IC, Offer Letter, Transfer Slip)
4. Current Occupancy — read-only tables for rooms & carparks
5. Booking History — all bookings matched by tenant_name + tenant_phone

## Critical Rules
- NO direct editing of room/carpark bindings from Tenant page
- Tenant can have multiple active rooms and carparks across locations
- Bookings linked via tenant_name + tenant_phone match
