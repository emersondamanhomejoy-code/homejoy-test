

## Phase 2 Completion — Remaining Page Migrations

Phase 2 shared components are built. Six pages already use them (Locations, Buildings, Bookings, Move-ins, Rooms, Activity Log). Three pages and two dialogs still need migration:

### Pages to migrate

**1. TenantsContent.tsx** (821 lines)
- Wrap with `StandardPageLayout`, `StandardFilterBar`, `StandardTable`
- Replace manual Dialog/AlertDialog with `StandardModal` and `ConfirmDialog`
- Replace inline action icon buttons with `ActionButtons`
- Keep all existing tenant CRUD logic intact

**2. UsersPage.tsx** (667 lines)
- Wrap with `StandardPageLayout`, `StandardFilterBar`, `StandardTable`
- Replace manual Dialog/AlertDialog with `StandardModal` and `ConfirmDialog`
- Replace inline action buttons with `ActionButtons` (including freeze/unfreeze)
- Keep commission config, role management, and freeze logic

**3. UnitsTableView.tsx** (369 lines)
- Wrap with `StandardFilterBar`, `StandardTable` (no page layout since it's embedded)
- Replace inline action buttons with `ActionButtons`
- Replace manual pagination with StandardTable pagination

### Dialogs to migrate

**4. BuildingForm.tsx** (516 lines)
- Wrap with `StandardModal` (size lg) instead of raw Dialog
- Gets sticky footer and discard confirmation automatically

**5. CreateBookingDialog.tsx** (726 lines)
- Wrap with `StandardModal` (size lg) instead of raw Dialog
- Gets sticky footer and discard confirmation automatically

### Approach
- Preserve all existing business logic — only swap layout/chrome components
- Use `inputClass` and `labelClass` from `ui-constants.ts`
- Each file migration is independent, no cross-dependencies

