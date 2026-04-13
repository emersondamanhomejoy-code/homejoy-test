

## Plan: Refactor Unit Create/Edit to Record-by-Record Pattern

### Problem
Current AddUnit pre-generates 5 room cards + 1 carpark card based on count inputs. This makes the form large, heavy, and inconsistent with the Building access record pattern.

### New Design

**Unit Details Section** — no change, stays as-is (text fields, dropdowns, checkbox, uploads).

**Rooms Section:**
- Starts empty with a header "Rooms" and an "Add Room" button
- Clicking "Add Room" opens an inline card/form for one room
- User fills in: Room Label, Room Type (Room/Studio), Bed Type, Wall Type, Max Pax, Listed Rental, Status, Available Date, Features, Remark
- "Save" collapses it into a compact summary row showing: Room Label | Bed Type | Rent | Status
- Each saved row has View / Edit / Delete actions
- Edit re-opens the inline form for that room
- Delete removes with confirmation

**Carparks Section:**
- Same pattern — starts empty, "Add Carpark" button
- Each carpark record: Label, Rent, Status, Assigned To, Remark
- Saved rows show: Label | Rent | Status
- View / Edit / Delete actions

### Technical Changes

**File: `src/pages/AddUnit.tsx` (~599 lines) — major rewrite**
- Remove room/carpark count inputs, naming convention selector, rebuildConfigs logic
- Remove collapsible card pattern and bulk generation
- Add local state array for room records and carpark records
- Each record has an `editing` flag — when true, show the inline form; when false, show summary row
- "Add Room" pushes a new blank record in editing mode
- "Save" on inline form validates and sets editing=false
- On final "Save Unit & Rooms", submit all records together (same mutation)

**File: `src/pages/EditUnit.tsx` (~636 lines) — major rewrite**
- Same record-by-record pattern
- Existing rooms from DB are displayed as summary rows
- "Add Room" / "Add Carpark" adds new records inline
- Edit opens inline form for existing room
- Delete calls useDeleteRoom with confirmation
- Save updates changed rooms via useUpdateRoom, creates new ones via useCreateRoom

**File: `src/components/UnitsRoomsContent.tsx`** — View modal already works, no change needed.

**No database changes** — rooms/units tables already support this pattern since rooms are individual DB rows.

### Consistency
This matches the Building access items pattern: empty list → add one at a time → compact saved rows → view/edit/delete each.

### Summary Row Format
| Room Label | Type | Bed Type | Rent | Status | Actions |
Each row is compact — one line per room, no accordion, no expand/collapse.

