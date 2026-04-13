

## Phased Rebuild Plan — HOMEJOY Operations Portal

### Current State Summary
- 4 roles (boss, manager, admin, agent) → migrating to 3 (Super Admin, Admin, Agent)
- Claims module exists but being deprecated
- Carparks stored in rooms table (keeping this)
- Missing modules: Move Out, Announcements, Payouts, Earnings

---

### Phase 1 — Role Migration & Sidebar Restructure
**Goal**: Clean foundation before building new features

- Migrate `boss` and `manager` roles to `super_admin` in database
- Update `app_role` enum: `super_admin`, `admin`, `agent`
- Update all RLS policies and `has_role()` function
- Update sidebar menus for all 3 roles per spec
- Update auth/login to use new role names
- Remove Claims from sidebar and routing
- Activity Log visible to Super Admin only

### Phase 2 — UI Standardization
**Goal**: Consistent modal, table, filter, and action patterns

- Standardize all modals: sticky bottom bar, no outside-click close, discard confirmation
- Standardize all table pages: title → action button → search/filters → table
- Standardize action labels: Add, View, Edit, Delete, Approve, Reject, Cancel
- Consistent status badges and colors across all modules
- Mobile responsive: full-screen modals, collapsible sidebar

### Phase 3 — Locations & Buildings Enhancement
**Goal**: Match spec for these simpler modules first

- Locations: add Buildings/Units/Rooms counts to table
- Buildings: restructure access rules (Pedestrian, Carpark, Motorcycle sections), visitor info
- Building view modal with sectioned layout
- Available counts shown as "X / Y" format

### Phase 4 — Units & Rooms / Carparks Enhancement
**Goal**: Capacity logic, Available Soon workflow, carpark management

- Units: add Remaining Pax, Remaining Rooms, Remaining Carparks columns
- Rooms: add Effective Remaining Capacity (min of room slots, unit remaining pax)
- Carpark management under Units (using rooms table with category flag)
- Available Soon: require Available On Date, no auto-switch, admin reminder system
- Room max pax defaults based on bed type

### Phase 5 — Tenants Module Enhancement
**Goal**: Read-only occupancy view, booking history, multi-room/carpark support

- Tenant detail: Current Occupancy (rooms + carparks tables)
- Tenant detail: Booking History table
- Enforce: no direct edit of room/carpark binding from tenant page
- Support multiple active rooms and carparks per tenant

### Phase 6 — Bookings Overhaul
**Goal**: Booking types, tenant selection, calculation engine

- 3 booking types: Room Only, Room+Carpark, Carpark Only
- Max 1 room + max 2 carparks per booking
- Tenant selection: pick existing or enter new, email duplicate check
- Booking cost calculation: advance rental, deposit, admin fee, access charges, parking
- Approval logic: set room/carpark to Pending, auto-create Move-in record
- Forfeit/Cancel logic with resolution type

### Phase 7 — Move In Overhaul
**Goal**: New status flow with Ready for Move-in, Reverse logic

- New statuses: Ready for Move-in → Submitted → Approved / Rejected / Reversed
- Auto-create from approved booking with "Ready for Move-in" status
- Agent submission form: agreement signed, payment method, remarks
- Admin approve: create occupancy, bind tenant to room/carpark, update unit summary
- Reverse Move-in: unbind occupancy, remove earnings effect, keep history

### Phase 8 — Move Out (New Module)
**Goal**: Handle real tenant departures

- New `move_outs` table
- Admin/Super Admin only
- Form: tenant, asset type, effective date, move-out type, reason, next status
- Logic: release tenant-room/carpark binding, update room status, preserve history

### Phase 9 — Payouts & Earnings (New Modules)
**Goal**: Replace claims with automated earnings from approved move-ins

- New `payouts` table for admin batch management
- Agent "My Deals" page: completed deals from approved move-ins
- Agent "Earnings" page: commission amounts, payout status, PDF download
- Admin "Payouts" page: generate batches, approve, mark paid, download PDF
- Commission calculation from user_roles commission_config

### Phase 10 — Announcements (New Module)
**Goal**: Internal communication system

- New `announcements` table
- Banner and Popup types
- Rich text description, image, link support
- Admin manages; agents see active announcements

### Phase 11 — Activity Log Enhancement
**Goal**: Comprehensive audit trail per spec

- Expand logging to cover all 15+ event categories in spec
- Before/After snapshots for data changes
- Enhanced filters: date range, actor, role, module, action
- Detail modal with full change diff
- Super Admin only access

### Phase 12 — Dashboard Overhaul
**Goal**: Role-specific dashboards with live data and quick actions

- Admin dashboard: review queues, Available Soon reminders, pending payouts
- Agent dashboard: pipeline cards matching new workflow
- Quick action buttons per spec

---

### Recommended Starting Phase
**Phase 1 (Role Migration)** — this is the foundation everything else depends on. Once roles are clean, we can build each module correctly.

### Technical Notes
- Database: New enum values, migration of existing role data, new tables for move_outs, payouts, announcements
- Carparks stay in `rooms` table using `room_category` or `special_type` field
- Claims tables left in place but unused (no code references)
- Each phase will be presented for your review before implementation

