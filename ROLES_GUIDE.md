# Your System Roles Explained

## Current Roles (4 total)

### 1. `super_admin` ✅ (You have this!)
- **Highest level** - Full system control
- Can create other admins
- Can change any user's role
- Full access to everything

### 2. `admin` ✅
- **Gym administration** - Different from super_admin
- Can manage classes, packages, users
- **Cannot** create super_admins
- **Cannot** change roles to super_admin
- Full operational access

### 3. `instructor` ✅ (This is your "tutor")
- **Class instructors/teachers** - Same as "tutor"
- Can manage classes they teach
- Can view bookings for their classes
- Limited admin access

### 4. `user` ✅
- **Regular members** - Default role
- Can book classes
- Can purchase packages
- Cannot access admin dashboard

---

## Differences

### `super_admin` vs `admin` - THEY ARE DIFFERENT!

- **super_admin**: Can create other admins, change roles, full control
- **admin**: Can manage operations, but **cannot** create super_admins or change roles to super_admin

### `instructor` = `tutor`

- In your database, it's called `instructor`
- This is the role for tutors/teachers
- They teach classes

---

## Missing Roles You Mentioned

You asked about:
- ❌ **`staff`** - NOT in your schema yet
- ❌ **`receptionist`** - NOT in your schema yet

---

## Quick Summary

**You currently have:**
1. ✅ `super_admin` (you)
2. ✅ `admin` (different from super_admin)
3. ✅ `instructor` (this is tutor)
4. ✅ `user` (regular members)

**You want to add:**
- ❌ `staff` (not yet in schema)
- ❌ `receptionist` (not yet in schema)

---

## Want to Add Staff Roles?

I can help you add `staff` and `receptionist` roles to your database if you want. Just let me know!

The hierarchy would be:
```
super_admin
    ↓
admin
    ↓
staff
receptionist  (same level)
    ↓
instructor
    ↓
user
```

