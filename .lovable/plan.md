

## Plan: Reposition Copy Buttons + Add Share Links

### Changes

**1. Move Copy buttons into Accordion headers**

Currently copy buttons are inside the expanded accordion content (right-aligned). Move them to the accordion trigger row, positioned to the left of the chevron icon. Add `Tooltip` on hover showing what gets copied (e.g., "Copy Building Details", "Copy Housemate Details").

This requires customizing the `AccordionTrigger` layout so the copy button sits inline in the header bar, always visible regardless of expand/collapse state. Click on the copy button will use `e.stopPropagation()` to prevent toggling the accordion.

**2. Top-right "Copy Link" button for public sharing**

Add a button at the top of the modal (next to the title area) that copies a shareable public link. This link opens a read-only page showing:
- Section 1: Condo/Common Area photos + building details
- Section 2: Unit common area photos + unit details
- Section 3: Room photos + room details

This requires:
- A new public route (e.g., `/view/:unitId/:roomId`) that does NOT require login
- The page fetches unit + room + condo data and displays photos and details in a clean read-only layout
- The copy button generates this URL and copies it to clipboard

**3. Per-section photo links**

In the accordion headers, add additional copy-link buttons:
- Building section: "Copy Common Area Link" — links to the public page scrolled to condo photos section
- Room Summary section: "Copy Room Photos Link" — or per-room links

### Technical Details

**File: `src/components/UnitsRoomsContent.tsx`**
- Restructure each `AccordionTrigger` to include copy icon button with tooltip, left of chevron
- Add share link button in modal header area
- Import `Tooltip` components

**New file: `src/pages/PublicUnitView.tsx`**
- Public read-only page at `/view/:unitId` (optionally `?room=roomId`)
- Fetches unit, rooms, condo data from Supabase (requires RLS policy for public read on these tables, or an edge function)
- Displays 3 sections: Condo Photos + Details, Unit Photos + Details, Room Photos + Details
- Clean, mobile-friendly layout for customers

**File: `src/App.tsx`**
- Add public route `/view/:unitId`

**Database: RLS consideration**
- Need a way for unauthenticated users to read specific unit/room/condo data
- Option A: Add a public RLS select policy on units/rooms/condos tables
- Option B: Create an edge function that returns the data without auth
- Option B is safer — avoids exposing all data publicly

### Layout Change (Accordion Header)

```text
┌─────────────────────────────────────────────────┐
│ Building Details — Condo · Location  [📋] [🔗] ▾│
└─────────────────────────────────────────────────┘
  📋 = Copy text (tooltip: "Copy Building Details")
  🔗 = Copy shareable link (tooltip: "Copy Common Area Link")
  ▾  = Accordion expand/collapse chevron
```

### Summary
- 4 files touched: `UnitsRoomsContent.tsx` (button repositioning), `PublicUnitView.tsx` (new), `App.tsx` (route), edge function or RLS for public access
- 1 migration if using RLS approach

