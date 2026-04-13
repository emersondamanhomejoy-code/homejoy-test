

## Phase 6 — Bookings UI Standardization

### Problem
The bookings module (1,984 lines across 4 files) is fully functional but uses raw `Dialog`, inline filters, and manual pagination instead of the shared UI components from Phase 2:
- `BookingsContent.tsx` (318 lines) — uses raw `Table`, inline filters/pagination instead of `StandardFilterBar` + `StandardTable`
- `BookingDetailView.tsx` (517 lines) — uses raw `Dialog` instead of `StandardModal`
- `BookingEditView.tsx` (456 lines) — uses raw `Dialog`, local `ic`/`lbl` class definitions instead of `StandardModal` + shared `inputClass`/`labelClass`
- `CreateBookingDialog.tsx` (693 lines) — already uses `StandardModal` + shared classes ✅

### Plan

**Step 1 — Migrate BookingsContent to StandardFilterBar + StandardTable**
- Replace the inline search/status bar + advanced filters grid with `StandardFilterBar`
- Replace raw `Table` + manual pagination with `StandardTable`
- Keep all existing filter logic (location, building, unit, room, agent, date range)
- Remove manual pagination controls (handled by StandardTable)

**Step 2 — Convert BookingDetailView to StandardModal**
- Replace raw `Dialog` + `ScrollArea` with `StandardModal` (size `lg`)
- Keep all existing sections (summary, room, parking, tenant profile, emergency, cost breakdown, documents, history)
- Move action buttons (approve/reject/cancel/delete) to `StandardModal` footer
- Keep the nested AlertDialogs for confirm actions

**Step 3 — Convert BookingEditView to StandardModal**
- Replace raw `Dialog` + `ScrollArea` with `StandardModal` (size `lg`)
- Replace local `ic`/`lbl` classes with shared `inputClass`/`labelClass` from `ui-constants.ts`
- Add `isDirty` discard confirmation
- Move save button to sticky footer

### Files to Modify
- **Modify**: `src/components/BookingsContent.tsx` — StandardFilterBar + StandardTable
- **Modify**: `src/components/BookingDetailView.tsx` — StandardModal
- **Modify**: `src/components/BookingEditView.tsx` — StandardModal + shared classes

### What stays the same
- `CreateBookingDialog.tsx` — already standardized
- All booking business logic (approve/reject/cancel/delete, room status updates, cost calculation)
- `useBookings.tsx` hook — no changes needed
- Database schema — no changes
