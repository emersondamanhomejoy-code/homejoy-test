# Project Memory

## Core
HOMEJOY Agent Portal — room rental management system.
Google OAuth only, no email/password auth.
Each unit has 5 rooms (A-E), rooms independently available/unavailable.
Lovable Cloud backend. Roles: admin, agent.
UI must be highly standardized — same action always looks/behaves the same.

## Memories
- [Room structure](mem://features/rooms) — Unit→5 rooms model, availability tracking
- [Product goal](mem://features/product-goal) — Global business objectives and problems to solve
- [Core business flow](mem://features/business-flow) — End-to-end pipeline from location to move-out
- [Status system](mem://features/status-system) — Room/booking/move-in status values and meanings
- [Role hierarchy](mem://features/roles) — Super Admin > Admin > Agent permissions
- [Building access](mem://features/building-access) — Pedestrian/carpark/motorcycle access items
- [Form dialogs](mem://design/form-dialogs) — All forms use Dialog modals with cancel confirmation
- [Commission tiers](mem://features/commission-tiers) — Per-agent customizable commission config
- [Area filter](mem://features/area-filter) — Valid area names for unit locations
- [Bookings](mem://features/bookings) — Booking submission and approval workflow
- [Tenant selection](mem://features/tenant-selection) — Tenant selection logic
- [No pets constraint](mem://constraints/no-pets) — No pets feature
