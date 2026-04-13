# Project Memory

## Core
HOMEJOY Agent Portal — room rental management system.
Google OAuth only, no email/password auth.
Each unit has 5 rooms (A-E), rooms independently available/unavailable.
Lovable Cloud backend. Roles: admin, agent, super_admin.

## Memories
- [Room structure](mem://features/rooms) — Unit→5 rooms model, availability tracking
- [Status system](mem://features/status-system) — Canonical statuses for rooms, bookings, move-ins with DB constraints
- [Commission tiers](mem://features/commission-tiers) — Per-agent customizable commission types
- [Area filter](mem://features/area-filter) — Valid area names for unit locations
- [Bookings](mem://features/bookings) — Agent/customer submit booking requests, admin approves/rejects
- [Building access](mem://features/building-access) — Building access item configuration
- [Roles](mem://features/roles) — User role system
- [Tenant selection](mem://features/tenant-selection) — Tenant linking in bookings
- [Form dialog pattern](mem://design/form-dialogs) — Modal patterns for add/edit forms
- [No pets](mem://constraints/no-pets) — Pet feature removed
