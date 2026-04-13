## Plan: Redesign Unit View Modal

This is a significant restructure of the Unit View modal in `UnitsRoomsContent.tsx`. The changes are UI-only — no database migrations needed.

### What Changes

**1. Simplify Occupant Summary**

- Replace the 4 stat cards with 2 compact fraction displays:
  - **Remaining Pax**: `4/6` (colored green if available, red if over)
  - **Remaining Carpark**: `1/2`
- Remove the separate "Current Housemates" table entirely — merge that info into Room Summary

**2. Redesign Room Summary Table**

- Columns: Code, Room Title, Rental, Status, Pax, Gender, Nationality, Tenant (admin-only)
- Remove Occupation from display
- "Tenant" column only visible for admin/super_admin users, hidden for agents
- Pax shows actual pax_staying count

**3. Redesign Carpark Summary Table**

- Remove "Remark" column
- Rename "Assigned To" → "Tenant" (admin-only, hidden for agents)
- Keep: Name, Lot, Rental, Status, Tenant

**4. Collapsible Accordion Sections**

- Wrap each section in an accordion: Building Details, Unit Details, Room Summary, Carpark Summary
- When collapsed, show a one-line summary (e.g., building name + location, unit type + max pax)
- Default state: all expanded (or Unit Details collapsed since less critical)

**5. Cost Breakdown Calculator**

- Add a new section at the bottom with inputs: number of pax, number of carparks
- Auto-calculate: 1 month advance rental, deposit (× multiplier), admin fee, access card fees, carpark rental
- Uses same logic as the Create Booking cost breakdown
- User selects a room from a dropdown to base calculation on

**6. Copy Buttons (per section)**

- Each section header gets a small "Copy" icon button
- Copies formatted text to clipboard:
  - **Copy Condo/Building Details** — building name, address, GPS link, amenities, access info
  - **Copy Unit Details** — unit, type, passcode, wifi, etc.
  - **Copy Room Summary / Housemate Details** — table formatted as text
  - **Copy Cost Breakdown** — the calculated cost as text
- Copies a link which can be opened to view Room Photo + details, Unit Photo + details, Condo Photo + details (has 3 section). This is for agent sending the link to customer to view the Room and the unit and its surround to understand more and increase chance of renting.
- No copy for Carpark section (per user request)

**7. Agent vs Admin Visibility**

- Room Summary and Carpark Summary: "Tenant" column hidden for agent role
- Uses existing `useAuth` hook to check role

### Technical Details

**File: `src/components/UnitsRoomsContent.tsx**` — Major rewrite of the View modal section (lines ~330–542):

- Import `useAuth` and `Accordion` components
- Replace stat cards with fraction display
- Remove Current Housemates table
- Add tenant/gender/nationality columns to Room Summary
- Remove Remark from Carpark, rename Assigned To → Tenant
- Wrap sections in Accordion
- Add Cost Breakdown section with room selector + pax/carpark inputs + auto-calc
- Add copy-to-clipboard buttons per section header
- Conditionally hide tenant columns based on user role

**File: `src/hooks/useAuth.tsx**` — Read only, to check how role is exposed (likely `user.role` or similar)

No other files need changes — this is contained to the View modal.

### Section Layout (top to bottom)

```text
┌─ Building Details (accordion) ──────────────────┐
│  Summary: "Condo Name · Location"    [📋 Copy]  │
│  Expanded: full building info + common photos    │
├─ Unit Details (accordion) ──────────────────────┤
│  Summary: "Unit A-12-3 · Mix Unit · 6 pax"      │
│  [📋 Copy]                                       │
│  Expanded: all unit fields                       │
├─ Occupant Summary ──────────────────────────────┤
│  Remaining Pax: 4/6    Remaining Carpark: 1/2   │
├─ Room Summary (accordion) ──────────────────────┤
│  [📋 Copy Housemate Details]                     │
│  Code | Title | Rental | Status | Pax | Gender  │
│       | Nationality | Tenant*                    │
├─ Carpark Summary (accordion) ───────────────────┤
│  Name | Lot | Rental | Status | Tenant*          │
├─ Cost Breakdown Calculator ─────────────────────┤
│  Select Room: [dropdown]                         │
│  Pax: [input]  Carparks: [input]                │
│  --- auto-calculated table ---        [📋 Copy] │
└─────────────────────────────────────────────────┘
* Tenant column: admin-only, hidden for agents
```