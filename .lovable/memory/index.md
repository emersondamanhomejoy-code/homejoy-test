# Project Memory

## Core
HOMEJOY Agent Portal — room rental management system.
Google OAuth only, no email/password auth.
Each unit has 5 rooms (A-E), rooms independently available/unavailable.
Lovable Cloud backend. Roles: boss > manager > admin > agent.
Activity log tracks all CRUD, role changes, approvals.

## Memories
- [Room structure](mem://features/rooms) — Unit→5 rooms model, availability tracking
- [Roles & permissions](mem://features/roles) — Boss/Manager/Admin/Agent hierarchy and access control
- [Commission tiers](mem://features/commission-tiers) — Per-agent customizable commission
- [Area filter](mem://features/area-filter) — Valid area names
- [Bookings](mem://features/bookings) — Agent/customer submit booking requests
