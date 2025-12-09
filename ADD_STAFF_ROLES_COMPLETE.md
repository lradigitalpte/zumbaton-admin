# Complete Guide: Adding Staff & Receptionist Roles

## ⚠️ Important: Two-Part Process

Adding roles requires **2 steps**:
1. ✅ Update database (SQL script)
2. ✅ Update TypeScript code (permissions, types, etc.)

---

## Step 1: Run Database SQL Script ✅

**YES, run this file:** `supabase/add_staff_roles.sql`

This will:
- Add `staff` and `receptionist` to allowed roles in database
- Update database constraints
- Create helper functions

---

## Step 2: Update TypeScript Code (Required!)

After running the SQL, you also need to update:

1. **Role types** (`src/api/schemas/user.ts`)
2. **Permission matrix** (`src/services/rbac.service.ts`)
3. **Role hierarchy** (`src/middleware/rbac.ts` and `src/services/rbac.service.ts`)
4. **Admin access** (`src/context/AuthContext.tsx`)

---

## Quick Answer

**YES, run the SQL script**, but let me also update the TypeScript code for you so everything works together!

Would you like me to:
1. ✅ Update the TypeScript files to support `staff` and `receptionist` roles?
2. ✅ Set up proper permissions for each role?
3. ✅ Make sure the admin dashboard recognizes them?

Or do you just want to run the SQL for now and update code later?

