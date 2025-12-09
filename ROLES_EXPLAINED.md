# User Roles Explained

## Current Roles in Your System

Your database currently has **4 roles** defined:

### 1. `super_admin` (You have this!)
- **Highest level access**
- Can create/manage other admins
- Full system access
- Can change user roles
- Can manage all settings

### 2. `admin`
- **Gym administration access**
- Can manage classes, packages, users
- Cannot create other super_admins
- Cannot change roles to super_admin
- Full operational access

### 3. `instructor` (This is your "tutor")
- **Class instructor access**
- Can manage classes they teach
- Can view bookings for their classes
- Cannot manage other users
- Limited admin access

### 4. `user`
- **Regular member**
- Can book classes
- Can purchase packages
- Cannot access admin dashboard
- Standard user privileges

---

## Role Hierarchy

```
super_admin  ← Highest (you are here)
    ↓
admin        ← Gym management
    ↓
instructor   ← Class instructors (tutors)
    ↓
user         ← Regular members
```

---

## Differences

### `super_admin` vs `admin`

**Super Admin:**
- Can create other admins and super_admins
- Can change any user's role
- Full system control
- Can delete admins

**Admin:**
- Can manage gym operations
- Can manage users (but not change roles to super_admin)
- Cannot create other super_admins
- Operational control only

### `instructor` = `tutor`

In your schema, **`instructor`** is the role for tutors/teachers. They can:
- Manage their own classes
- View bookings for their classes
- Mark attendance
- Update class details

---

## What You Asked About

You mentioned:
- ✅ `super_admin` - **EXISTS** (you have this)
- ✅ `admin` - **EXISTS** (different from super_admin)
- ❌ `staff` - **NOT in schema** (you might want this)
- ✅ `tutor` - **EXISTS as `instructor`** (same thing)

---

## Missing Roles?

If you want to add `staff` or `receptionist` roles, we can:
1. Update the database schema to allow these roles
2. Add them to the role hierarchy
3. Set up their permissions

Would you like me to add `staff` and `receptionist` roles?

---

## Quick Summary

**You have 4 roles:**
1. `super_admin` - Full control (you)
2. `admin` - Gym management
3. `instructor` - Tutors/teachers
4. `user` - Regular members

**Missing (if you want them):**
- `staff` - General staff members
- `receptionist` - Front desk staff

Would you like me to add the missing roles to your schema?

