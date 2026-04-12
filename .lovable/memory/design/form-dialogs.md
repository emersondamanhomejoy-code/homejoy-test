---
name: Form Dialog Pattern
description: All add/edit forms use Dialog modals with cancel confirmation AlertDialog
type: design
---
All "Add" and "Edit" forms across the admin panel use Dialog (modal) overlays instead of inline forms or page navigation.
- Small forms (Location): Dialog sm:max-w-md
- Medium forms (Building): Dialog sm:max-w-2xl with ScrollArea
- Large forms (Unit, Booking): Dialog sm:max-w-3xl with ScrollArea
- Cancel/close triggers AlertDialog asking "Discard changes?" ONLY if form has actual changes (compare current vs initial values). If no fields were modified, close immediately without confirmation.
- Uses shadcn Dialog + AlertDialog + ScrollArea components
