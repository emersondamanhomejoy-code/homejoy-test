---
name: Role hierarchy and permissions
description: Super Admin > Admin > Agent with different access levels, multi-role support, and protection rules
type: feature
---
## Role Hierarchy
- **Super Admin**: Full access + activity log, reverse move-ins, manage admin/agent users
- **Admin**: Manage locations/buildings/units/rooms/tenants/bookings/move-in/move-out/payouts/announcements, manage agent users only
- **Agent**: Dashboard, available rooms, my bookings, move-in, my deals, earnings, announcements, profile

## Multi-role Support
- A user can have multiple roles (e.g. Admin + Agent)
- If user has Agent role → show agent financial and commission settings
- If user has only Admin role → do NOT show agent financial fields

## Protection Rules
- User cannot delete themselves
- User cannot remove their own critical role
- Admin cannot delete or downgrade Super Admin
- Activity Log visible only to Super Admin

## Key Rules
- All 3 roles stored in app_role enum: super_admin, admin, agent
- Old roles (boss, manager) migrated to super_admin
