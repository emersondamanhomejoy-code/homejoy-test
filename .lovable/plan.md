

## Plan: Redesign Room/Carpark Cards with Collapsible Pattern

### Problem
1. Car park default rent should be RM150
2. Car park cards don't need "More Details" — they're simple enough to show inline
3. Room cards look bulky and ugly — too many large cards open at once
4. User wants the same collapsible pattern as Building Form's access items (fill → save/collapse → compact summary)

### Design Decision
Use the **fill-then-collapse** pattern from BuildingForm access items:
- Each room/carpark starts **expanded** (editable) with ALL fields visible inline — no "More Details" dialog
- After filling, user clicks a **Save/Collapse button** (💾) to collapse it into a compact one-line summary
- Collapsed state shows: Room name, Bed Type, Rent, Status — with Edit (✏️) and Delete (🗑️) icons
- User can re-expand any item to edit
- Remove the "More Details" dialog entirely

### Changes

**`src/pages/AddUnit.tsx`**:

1. **Car park default rent = RM150** — update `rebuildConfigs` and initial state to set `rent: 150` for car park entries

2. **Room card redesign — collapsible pattern**:
   - Add `collapsedRooms` state (`Record<number, boolean>`) to track which cards are collapsed
   - **Expanded room card** shows ALL fields inline (bed type, rent, max pax, status, wall type, special type, available date) — no dialog needed
   - **Expanded car park card** shows: parking lot, rent (default 150), status — all inline, no "More Details"
   - **Collapse button** (Save icon) on each card to collapse after filling
   - **Collapsed state** renders a compact single-line summary: `Room A · Queen · RM650 · Available` with Edit/Delete buttons
   - Car park collapsed: `🅿️ Car Park · B1-23 · RM150 · Available`

3. **Remove the "More Details" Dialog** entirely — all fields are now inline in the expanded card

4. **Remove `editingRoomConfigIndex` state** and the Dialog component for room details

### Technical Details
- Reuse the same visual pattern as `BuildingForm`'s `renderAccessItem`: collapsed = summary bar with Pencil/Trash icons, expanded = bordered card with Save/Trash icons
- Room fields in expanded state arranged in a 2-column or 3-column grid
- Car park fields in expanded state: 3 fields (Parking Lot, Rent, Status) in a single row

