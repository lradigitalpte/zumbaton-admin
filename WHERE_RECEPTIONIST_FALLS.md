# Where Does Receptionist Fall in the Hierarchy?

## Recommended Role Hierarchy

```
┌─────────────────────────────────────────┐
│  super_admin  (Level 100)               │
│  • Full system control                  │
│  • Can create other admins              │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  admin  (Level 80)                      │
│  • Gym management                       │
│  • Create packages & classes            │
│  • Manage all operations                │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  receptionist  (Level 60) ⬅️ HERE!      │
│  • Front desk operations                │
│  • Manage all bookings                  │
│  • Check-in & attendance                │
│  • Process payments                     │
│  • View all users                       │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  instructor  (Level 50)                 │
│  • Teach classes                        │
│  • Manage their own classes             │
│  • View bookings for their classes      │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  user  (Level 10)                       │
│  • Book classes                         │
│  • Purchase packages                    │
└─────────────────────────────────────────┘
```

## Why This Placement?

### Receptionist vs Admin
- ❌ Receptionist **CANNOT** create packages/classes
- ❌ Receptionist **CANNOT** delete users or change roles
- ✅ Receptionist **CAN** manage all bookings & check-ins
- ✅ Receptionist **CAN** view all users & process payments

### Receptionist vs Instructor
- ✅ Receptionist **CAN** manage ALL bookings (not just specific classes)
- ✅ Receptionist **CAN** view all users
- ✅ Receptionist **CAN** process payments
- ❌ Instructor can only manage their own classes

### Receptionist vs User
- ✅ Receptionist **CAN** access admin dashboard
- ✅ Receptionist **CAN** manage other people's bookings
- ❌ User can only manage their own bookings

## Summary

**Receptionist falls between admin and instructor** because:
1. They need MORE access than instructors (all bookings, all users)
2. They need LESS access than admins (no package/class creation)

**Level 60** is the right spot! 🎯

