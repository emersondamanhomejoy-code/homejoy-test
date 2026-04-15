---
name: Button Standards
description: Standardized button labels, colors, and variants for all modal/dialog actions
type: design
---
## Modal Footer Button Labels
- Primary save action: "Save" (not "Save Building", "Save Changes", "Save Unit & Rooms")
- Primary submit action: "Submit" (not "Create Booking", "Send Invite")
- Loading state: "Saving..." or "Submitting..."
- View-only modals: "Close"

## Button Color Rules
- **Primary actions** (Save, Submit): default variant (blue/primary)
- **Cancel/secondary**: variant="ghost" with hover:bg-accent/20 hover:text-accent (transparent, green on hover)
- **Dangerous actions** (Delete, Reject, Cancel Record, Terminate): variant="destructive" (red)
- **Approve**: bg-accent hover:bg-accent/90 text-accent-foreground (green via accent token)
- **Save Draft / secondary non-dangerous**: variant="ghost" with same green hover as cancel

## Expand/Collapse All Button
- Single toggle button (not two separate buttons)
- Label toggles: "Expand All" when any section collapsed, "Collapse All" when all expanded
- variant="outline" size="sm" className="text-xs bg-card shadow-md"
- **Position: fixed top-4 right-4 z-50** — stays visible when scrolling
- Placed above all content including stat cards

## Never use hardcoded colors
Use design tokens (bg-accent, bg-destructive, bg-primary) not bg-green-600, bg-red-500 etc.
