---
name: Role hierarchy and permissions
description: Super Admin > Admin > Agent with different access levels and user creation rights
type: feature
---
## Role Hierarchy
- **Super Admin**: Full access + activity log, can create admin/agent
- **Admin**: Manage rooms/bookings/users/move-ins/payouts, can create agent only
- **Agent**: Submit bookings, move-ins, view deals/earnings only

## Key Rules
- Admin cannot create Super Admin accounts
- Super Admin is the only one who can view Activity Log
- All 3 roles stored in app_role enum: super_admin, admin, agent
- Old roles (boss, manager) migrated to super_admin
