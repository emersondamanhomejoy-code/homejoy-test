

## Phase 4 — Units & Rooms Overhaul

### Problem
The unit/room management code is duplicated across multiple files:
- `AdminContent.tsx` (1339 lines) contains its own unit CRUD logic, room config builders, and inline dialogs — duplicating what `AddUnit.tsx` (671 lines) and `EditUnit.tsx` (687 lines) already do as full pages
- `AddUnit` and `EditUnit` are full-page routes (`/admin/add-unit`, `/admin/edit-unit/:id`) but should be modal-based per the Phase 2 pattern (consistent with BuildingForm)
- `ViewUnit.tsx` is also a separate page — should be a modal
- `UnitsTableView.tsx` still uses raw filters instead of `StandardFilterBar`
- Local `inputClass` definitions in AddUnit/EditUnit instead of shared constants

### Plan

**Step 1 — Convert AddUnit to StandardModal**
- Wrap AddUnit content inside `StandardModal` (size `xl`) instead of a full-page layout
- Remove the route `/admin/add-unit` — open as modal from UnitsTableView
- Use shared `inputClass`/`labelClass` from `ui-constants.ts`
- Keep all existing room config logic (dynamic count, naming, photos, carpark)

**Step 2 — Convert EditUnit to StandardModal**
- Same treatment — wrap in `StandardModal` (size `xl`)
- Remove route `/admin/edit-unit/:unitId`
- Support opening from UnitsTableView and RoomsContent (with `focusRoomId`)
- Keep inline room editing, add/delete room, save logic

**Step 3 — Convert ViewUnit to StandardModal**
- Replace the full-page `/admin/view-unit/:unitId` route with a view modal
- Already partially done in `UnitsTableView` (has inline view dialog) — consolidate into one component

**Step 4 — Clean up AdminContent.tsx**
- Remove all duplicate unit CRUD logic (openCreateRoom2, rebuildRoomConfigs, handleRoomCountChange, etc.)
- Remove the old inline unit create/edit dialogs
- AdminContent should just render `UnitsTableView` for the units tab — no unit-specific state
- Target: reduce AdminContent from ~1339 lines to ~600-700 lines

**Step 5 — Migrate UnitsTableView filters to StandardFilterBar**
- Replace the manual filter card with `StandardFilterBar`
- Keep MultiSelectFilter components for Location/Building
- Add clear filters button

**Step 6 — Clean up routes**
- Remove `/admin/add-unit`, `/admin/view-unit/:unitId`, `/admin/edit-unit/:unitId` routes from App.tsx
- Delete `src/pages/ViewUnit.tsx` (logic moves to modal)
- `AddUnit.tsx` and `EditUnit.tsx` become modal components (can stay in `/pages` or move to `/components`)

### Files to Create/Modify
- **Modify**: `src/pages/AddUnit.tsx` — convert to modal component
- **Modify**: `src/pages/EditUnit.tsx` — convert to modal component
- **Delete**: `src/pages/ViewUnit.tsx` — replaced by inline modal in UnitsTableView
- **Modify**: `src/components/UnitsTableView.tsx` — use StandardFilterBar, host Add/Edit/View modals
- **Modify**: `src/components/AdminContent.tsx` — remove duplicate unit logic
- **Modify**: `src/components/RoomsContent.tsx` — open EditUnit modal instead of navigating
- **Modify**: `src/App.tsx` — remove unit page routes

### What stays the same
- All room configuration logic (dynamic count, naming, bed types, wall types, features, photos, carparks)
- Database schema — no changes needed
- Unit/Room CRUD hooks in `useRooms.tsx`

