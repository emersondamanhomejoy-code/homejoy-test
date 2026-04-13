# Project Memory

## Core
HOMEJOY Agent Portal — room rental management system.
Google OAuth only, no email/password auth.
Each unit has 5 rooms (A-E), rooms independently available/unavailable.
Lovable Cloud backend. Roles: admin, agent.

## Memories
- [Room structure](mem://features/rooms) — Unit→5 rooms model, availability tracking
- [Room status rules](mem://features/room-status-rules) — Final status transition logic: Available↔Archived, Occupied→Available Soon, Pending/Available Soon read-only
- [Status system](mem://features/status-system) — Canonical status values for rooms, bookings, move-ins
- [Tenant page](mem://features/tenants) — Table columns, detail sections, filters, occupancy display, booking history
- [Product goal](mem://features/product-goal) — Agent portal for room rental management
- [Business flow](mem://features/business-flow) — Booking→Approval→Move-in→Approval workflow
- [Roles](mem://features/roles) — Admin, agent role definitions
- [Bookings](mem://features/bookings) — Agent/customer submit booking requests
- [Locations](mem://features/locations) — Location management
- [Building access](mem://features/building-access) — Building access info structure
- [Commission tiers](mem://features/commission-tiers) — Per-agent commission config
- [Area filter](mem://features/area-filter) — Valid area names
- [Dashboard](mem://features/dashboard) — Dashboard layout
- [Tenant selection](mem://features/tenant-selection) — Tenant selection in booking
- [Form dialogs](mem://design/form-dialogs) — Standard form/dialog patterns
- [UI/UX requirements](mem://design/ui-ux-requirements) — Design system rules
- [No pets](mem://constraints/no-pets) — No pet features
