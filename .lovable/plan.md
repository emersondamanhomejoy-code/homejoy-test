

## Phase 2 — UI Standardization

### What This Phase Does
Creates reusable shared components that enforce consistent UI patterns across all pages. Then migrates existing pages to use them. All future modules (Phases 3-12) will use these components automatically.

### Shared Components to Create

**1. `StandardPageLayout`** — wraps every list page
- Props: `title`, `actionLabel`, `actionIcon`, `onAction`, `children`
- Renders: page title (left), primary action button (top-right), then children
- Consistent spacing and animation

**2. `StandardModal`** — wraps all create/edit/view modals
- Props: `open`, `onOpenChange`, `title`, `size` (sm/md/lg/xl), `children`, `footer`
- Blocks outside-click close (`onInteractOutside` + `onEscapeKeyDown` prevented)
- Sticky bottom action bar: Cancel left, primary action right
- ScrollArea for content
- Optional `isDirty` prop — if true, closing triggers discard confirmation AlertDialog automatically
- Size mapping: sm → max-w-md, md → max-w-2xl, lg → max-w-3xl, xl → max-w-4xl

**3. `StandardFilterBar`** — search + filters row
- Props: `search`, `onSearchChange`, `placeholder`, `children` (filter slots)
- Consistent search input styling + grid layout for filters
- Optional collapsible "Advanced Filters" section

**4. `StandardTable`** — table wrapper with empty state and pagination
- Props: `columns`, `data`, `emptyMessage`, `page`, `pageSize`, `total`, `onPageChange`
- Wraps existing Table in card with border
- Built-in empty state row
- Built-in pagination footer

**5. `ActionButtons`** — consistent action button set for table rows
- Props: array of actions (`view`, `edit`, `delete`, `approve`, `reject`, etc.)
- Standardized icon buttons with consistent hover styles
- Dangerous actions (delete, cancel, reverse) use destructive hover color

**6. `ConfirmDialog`** — reusable confirmation modal
- Props: `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `variant` (default/destructive), `onConfirm`, optional `reasonRequired`
- When `reasonRequired`: shows textarea, disables confirm until reason entered
- Used for: Delete, Cancel, Reject, Reverse actions

**7. Update `StatusBadge`** — add missing statuses
- Add: `Submitted`, `Ready for Move-in`, `Reversed`, `Paid`, `Generated`
- Normalize casing (accept both `submitted` and `Submitted`)
- Consistent color scheme across all modules

### Standardized Styling Constants
- Create `src/lib/ui-constants.ts` with shared input classes, label classes
- Replace inline `inputClass` / `labelClass` strings scattered across components

### Migration of Existing Pages
Apply shared components to these existing pages (minimal logic changes, just wrapping):

1. **LocationsContent** — wrap with StandardPageLayout + StandardModal + StandardTable
2. **CondosContent** — wrap with StandardPageLayout + StandardModal + StandardTable  
3. **BookingsContent** — wrap with StandardPageLayout + StandardFilterBar + StandardTable + ConfirmDialog
4. **MoveInContent** — wrap with StandardPageLayout + StandardFilterBar + StandardTable
5. **TenantsContent** — wrap with StandardPageLayout + StandardFilterBar + StandardTable
6. **UsersPage** — wrap with StandardPageLayout + StandardFilterBar + StandardTable
7. **RoomsContent** — wrap with StandardPageLayout + StandardFilterBar + StandardTable
8. **UnitsTableView** — wrap with StandardPageLayout + StandardFilterBar + StandardTable
9. **ActivityLogPage** — wrap with StandardPageLayout + StandardFilterBar + StandardTable
10. **BuildingForm** — wrap edit/create with StandardModal (large size)
11. **CreateBookingDialog** — wrap with StandardModal (large size)

### Mobile Responsive Updates
- StandardModal: on mobile (`< 768px`), modal becomes near-full-screen with bottom action bar always visible
- Sidebar: already collapsible, no changes needed
- StandardFilterBar: stack filters vertically on mobile

### Files to Create
- `src/components/ui/standard-page-layout.tsx`
- `src/components/ui/standard-modal.tsx`
- `src/components/ui/standard-filter-bar.tsx`
- `src/components/ui/standard-table.tsx`
- `src/components/ui/action-buttons.tsx`
- `src/components/ui/confirm-dialog.tsx`
- `src/lib/ui-constants.ts`

### Files to Modify
- `src/components/StatusBadge.tsx` — add new statuses
- All 11 content pages listed above — wrap with shared components
- `src/components/BuildingForm.tsx` — convert to modal-based
- `src/components/CreateBookingDialog.tsx` — use StandardModal

### Approach
Build shared components first, then migrate pages one by one. Each page migration preserves existing logic — only the layout/chrome changes.

