# Project Memory

## Core
HOMEJOY Operations Portal — room rental management system.
Google OAuth only, no email/password auth.
Lovable Cloud backend. Roles: super_admin, admin, agent.
Claims module deprecated. Workflow: Booking → Move-in → Done.
No pets allowed in units (max_pets always 0).

## Memories
- [Room structure](mem://features/rooms) — Unit→dynamic rooms, carparks in rooms table
- [Role hierarchy](mem://features/roles) — Super Admin > Admin > Agent permissions
- [Commission tiers](mem://features/commission-tiers) — Per-agent customizable commission config
- [Building access](mem://features/building-access) — Pedestrian, carpark, motorcycle access rules
- [Bookings](mem://features/bookings) — Agent/customer submit booking, admin approves/rejects
- [Tenant selection](mem://features/tenant-selection) — Select existing or create new tenant in booking
- [Form dialogs](mem://design/form-dialogs) — Modal-based forms, no side drawers
- [No pets](mem://constraints/no-pets) — max_pets always 0
- [Area filter](mem://features/area-filter) — Valid area names for locations
