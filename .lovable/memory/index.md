# Memory: index.md
Updated: now

# Project Memory

## Core
HOMEJOY Agent Portal — room rental management system.
Google OAuth only, no email/password auth.
Each unit has 5 rooms (A-E), rooms independently available/unavailable.
Lovable Cloud backend. Roles: admin, agent.

## Memories
- [Room structure](mem://features/rooms) — Unit→5 rooms model, availability tracking
- [Status system](mem://features/status-system) — Canonical statuses for rooms, bookings, move-ins
- [Room status rules](mem://features/room-status-rules) — No manual Occupied; only via booking/move-in workflow
- [Tenant selection](mem://features/tenant-selection) — Occupied rooms select tenant from approved bookings
- [Business flow](mem://features/business-flow) — End-to-end pipeline: location→building→unit→room→booking→move-in
- [Commission tiers](mem://features/commission-tiers) — Per-agent customizable commission config
- [Area filter](mem://features/area-filter) — Valid area names for unit locations
- [Bookings](mem://features/bookings) — Agent/customer submit booking, admin approves/rejects
- [Form dialogs](mem://design/form-dialogs) — StandardModal pattern for create/edit forms
- [UI/UX requirements](mem://design/ui-ux-requirements) — Design system and layout rules
- [Product goal](mem://features/product-goal) — System purpose and target users
- [Roles](mem://features/roles) — Admin, agent role definitions
- [Building access](mem://features/building-access) — Record-by-record access items pattern
- [Locations](mem://features/locations) — Location management
- [Dashboard](mem://features/dashboard) — Dashboard layout and content
- [No pets](mem://constraints/no-pets) — No pet features
