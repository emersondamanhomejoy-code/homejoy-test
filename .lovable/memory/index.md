# Project Memory

## Core
HOMEJOY Agent Portal — room rental management system.
Google OAuth only, no email/password auth.
Each unit has 5 rooms (A-E), rooms independently available/unavailable.
Lovable Cloud backend. Roles: admin, agent.
No pets allowed — ignore all pet-related requests.

## Memories
- [Room structure](mem://features/rooms) — Unit → dynamic rooms (default 5, add/remove), tenant info, passcode, parking lot
- [Tenant selection](mem://features/tenant-selection) — Occupied rooms/carparks select tenant from approved bookings, no manual occupant entry
- [No pets](mem://constraints/no-pets) — No pet support, remove all pet fields
- [Commission tiers](mem://features/commission-tiers) — Per-agent customizable commission types and tiers
- [Area filter](mem://features/area-filter) — All valid area names used in the system
- [Bookings](mem://features/bookings) — Agent/customer submit booking requests, admin approves/rejects
- [Form dialogs](mem://design/form-dialogs) — Design patterns for form dialogs
- [Building access](mem://features/building-access) — Building access items collapsible pattern
- [Roles](mem://features/roles) — User role system (admin, agent, boss, manager)
