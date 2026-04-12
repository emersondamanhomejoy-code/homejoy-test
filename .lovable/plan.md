

## Problem

The accordion expanded view in Units & Rooms uses a CSS grid with fixed pixel widths (`grid-cols-[60px_80px_80px_120px_60px_70px_140px_60px_80px_70px]`), causing text to be cramped and overlapping. It looks very different from the clean `<Table>` used in View Unit.

## Solution

Replace the custom CSS grid layout in the accordion expanded section with a proper `<Table>` component — matching the exact same design used in the View Unit dialog/page.

### Changes in `src/components/UnitsRoomsContent.tsx` (lines ~318–376)

**Rooms sub-section:** Replace the `<div className="grid ...">` structure with a `<Table>` using the same columns as View Unit:
- Room, Bed Type, Wall Type, Features, Max Pax, Rental (RM), Status, Pax Staying, Nationality, Gender

Use `<TableHeader>`, `<TableRow>`, `<TableHead>`, `<TableCell>` — identical markup to `ViewUnit.tsx` lines 91–139.

**Carparks sub-section:** Same treatment — replace grid with `<Table>` matching ViewUnit's carpark table (lines 152–172).

This ensures consistent, readable formatting with proper spacing, alignment, and responsive overflow scrolling via the `<Table>` wrapper's built-in `overflow-auto`.

