

## Cleanup — Delete Orphaned UnitsTableView

All three requested tasks from Phase 4 are already complete:
- **UnitsTableView migration**: Done — `UnitsRoomsContent.tsx` uses `StandardFilterBar` and `StandardTable`
- **AdminContent cleanup**: Done — reduced from ~1339 to 263 lines, delegates to `UnitsRoomsContent`
- **Route cleanup & ViewUnit deletion**: Done — no unit page routes remain, `ViewUnit.tsx` deleted

### One remaining action

**Delete `src/components/UnitsTableView.tsx`** — 313-line file that is no longer imported anywhere. It was fully replaced by `UnitsRoomsContent.tsx`.

