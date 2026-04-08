---
name: Role hierarchy and permissions
description: Boss > Manager > Admin > Agent with different access levels and user creation rights
type: feature
---
## Role Hierarchy
- **Boss**: Full access + activity log, can create manager/admin/agent
- **Manager**: Same as boss, can create admin/agent (NOT manager)
- **Admin**: Manage rooms/bookings/users/claims, can create agent only (NOT manager)
- **Agent**: Submit bookings and claims only, no admin panel

## Key Rules
- Admin cannot create manager accounts
- Manager can create admin accounts
- Boss is the only one who can create manager accounts
- Activity log visible only to boss and manager
- All 4 roles stored in app_role enum: boss, manager, admin, agent
