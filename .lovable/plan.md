

## Plan: Enhance Unit View Modal

### 1. Replace Remaining Pax/Carpark text with Statistic Cards

Replace the plain text "Remaining Pax: 4/6" and "Remaining Carpark: 1/2" with two styled `Card` components showing the fraction prominently with labels underneath.

### 2. Add Access Info to Building Details section

Display three sub-sections inside Building Details accordion:
- **Pedestrian Access** — list each item with type, locations, provided by, chargeable info, price, instructions
- **Car Park Access** — same fields
- **Motorcycle Access** — same fields
- **Visitor Info** — visitor car parking, visitor motorcycle parking (from condo data)

Data comes from `condo.access_items` JSONB (keys: `pedestrian`, `carpark`, `motorcycle`) and `condo.visitor_car_parking` / `condo.visitor_motorcycle_parking`.

### 3. Reorder sections

Current: Stats → Building → Unit → Rooms → Carparks → Cost Calculator

New order: **Stats → Room Summary → Carpark Summary → Unit Details → Building Details → Cost Calculator**

### 4. Add "Copy Common Area Photos" link button (top-right)

Add a second button next to "Copy Share Link" that copies a public URL pointing to `/view/:unitId?section=photos` — a new section on the public page that shows ONLY common area photos (no building details, no unit info).

### 5. Add "Copy Room Photos" link in Room detail view

When viewing a specific room (the sub-view with Back button), add a link-copy button that copies `/view/:unitId?room=:roomId&section=photos` — the public page filtered to show only that room's photos.

### 6. Update PublicUnitView for photo-only mode

When `section=photos` and no `room` param: show only common area + condo photos.
When `section=photos` and `room` param: show only that room's photos.

### 7. Public page — sensitive data to HIDE

Currently the public page shows: Unit type, Max occupants. These are safe.
Should NOT show (and currently doesn't): passcode, WiFi name/password, meter info, deposit/admin fee, internal remarks, tenant names, assigned agent. The current public page is already safe. No changes needed here.

### Technical Details

**File: `src/components/UnitsRoomsContent.tsx`**
- Import `Card, CardContent` from ui/card
- Replace lines 600-614 (compact fractions) with two stat cards
- Move the Accordion item order: rooms → carparks → unit → building
- Add access info rendering inside Building Details accordion content (parse `condo.access_items.pedestrian/carpark/motorcycle` arrays, display visitor parking info)
- Add "Copy Common Area Photos" button next to "Copy Share Link" at top
- Add "Copy Room Photos Link" button in the room detail sub-view

**File: `src/pages/PublicUnitView.tsx`**
- Handle `section=photos` mode: if no room param, show only common area/condo photos; if room param, show only that room's photos
- Keep existing full-view behavior for other section values

### Section Order (final)

```text
┌─────────────────────────────────────────────────┐
│ Unit Details — Building · Unit     [📷 Photos] [🔗 Share] │
├─────────────────────────────────────────────────┤
│  [Remaining Pax: 4/6]   [Remaining Carpark: 1/2]  │  ← Stat Cards
├─ Room Summary (accordion) ──────────────────────┤
├─ Carpark Summary (accordion) ───────────────────┤
├─ Unit Details (accordion) ──────────────────────┤
├─ Building Details (accordion) ──────────────────┤
│   ... existing fields ...                        │
│   Pedestrian Access: Face ID @ Guard House ...   │
│   Car Park Access: RFID ...                      │
│   Motorcycle Access: ...                         │
│   Visitor Car Parking: ...                       │
│   Visitor Motorcycle Parking: ...                │
├─ Cost Breakdown Calculator ─────────────────────┤
└─────────────────────────────────────────────────┘
```

