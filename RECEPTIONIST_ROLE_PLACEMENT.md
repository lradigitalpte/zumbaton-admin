# Where Does Receptionist Fall in the Role Hierarchy?

## Current Hierarchy

```
super_admin  (Level 100) - Full control
    ↓
admin        (Level 80)   - Gym management
    ↓
instructor   (Level 50)   - Class instructors/tutors
    ↓
user         (Level 10)   - Regular members
```

## Where Receptionist Should Fall

**Receptionist should be between `admin` and `instructor`:**

```
super_admin  (Level 100) - Full control
    ↓
admin        (Level 80)   - Gym management
    ↓
receptionist (Level 60)   - Front desk operations ⬅️ HERE
    ↓
instructor   (Level 50)   - Class instructors/tutors
    ↓
user         (Level 10)   - Regular members
```

## Receptionist Permissions

**Receptionist should be able to:**

✅ **View/Manage:**
- View all users (front desk needs to look up members)
- View all bookings
- Manage bookings (check in, cancel)
- View all classes
- Mark attendance
- View packages
- Process payments (at front desk)

❌ **Cannot:**
- Create/delete packages
- Create/delete classes
- Delete users
- Change user roles
- System settings

## Comparison

| Feature | Admin | Receptionist | Instructor |
|---------|-------|--------------|------------|
| Manage bookings | ✅ All | ✅ All | ❌ Only their classes |
| Check attendance | ✅ All | ✅ All | ✅ Only their classes |
| View all users | ✅ | ✅ | ❌ |
| Process payments | ✅ | ✅ | ❌ |
| Create packages | ✅ | ❌ | ❌ |
| Create classes | ✅ | ❌ | ✅ (their own) |
| Delete users | ✅ | ❌ | ❌ |
| Change roles | ✅ | ❌ | ❌ |

## Why This Placement?

1. **More access than instructor**: Receptionist needs to manage ALL bookings/attendance, not just specific classes
2. **Less access than admin**: Receptionist shouldn't create packages/classes or change roles
3. **Front desk operations**: Primary job is customer service, bookings, check-ins

## Recommended Hierarchy Numbers

```typescript
const ROLE_HIERARCHY = {
  super_admin: 100,
  admin: 80,
  receptionist: 60,  // ⬅️ Between admin and instructor
  instructor: 50,
  user: 10
}
```

---

**Summary**: Receptionist should be **above instructor, below admin** - giving them front desk operational access without full admin privileges.

