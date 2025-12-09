# How to Give People More Permissions

Yes! Your permission system is **fully customizable**. Here are 3 ways to give people more permissions:

---

## Method 1: Modify Role Permissions (Easiest)

Edit what each role can do by updating the permission matrix.

**File:** `src/services/rbac.service.ts`

### Example: Give receptionist more permissions

```typescript
const PERMISSION_MATRIX: Record<UserRole, Record<PermissionResource, PermissionAction[]>> = {
  // ... existing roles ...
  
  receptionist: {
    users: ['view_all', 'view_own', 'edit_all'],  // Add 'edit_all' to give more access
    packages: ['view', 'create'],                   // Add 'create' if needed
    classes: ['view', 'create', 'edit_all'],        // Add more class permissions
    bookings: ['view_all', 'view_own', 'create', 'cancel_all'],
    attendance: ['view_all', 'view_own', 'check_in', 'mark_no_show'],
    tokens: ['view_all', 'view_own', 'adjust'],     // Add 'adjust' if needed
    analytics: ['view'],                            // Add analytics access
    settings: ['gym'],                              // Add settings access
  },
}
```

---

## Method 2: Add New Permissions (More Granular Control)

Add completely new permissions to the system.

### Step 1: Add to TypeScript Types

**File:** `src/api/schemas/user.ts`

```typescript
export type PermissionAction = 
  | 'view_all' | 'view_own' 
  | 'create' | 'edit_all' | 'edit_own' 
  | 'delete' | 'cancel_all' | 'cancel_own'
  | 'purchase' | 'check_in' | 'mark_no_show' | 'adjust'
  | 'view' | 'export' | 'system' | 'gym' | 'change_role'
  | 'refund'      // ⬅️ NEW permission
  | 'approve'     // ⬅️ NEW permission
  | 'reject';     // ⬅️ NEW permission

export type PermissionResource = 
  | 'users' | 'packages' | 'classes' | 'bookings' 
  | 'attendance' | 'tokens' | 'analytics' | 'settings'
  | 'refunds'     // ⬅️ NEW resource
  | 'reports';    // ⬅️ NEW resource
```

### Step 2: Add to Database

**Run in Supabase SQL Editor:**

```sql
-- Add new permissions
INSERT INTO permissions (name, description, resource, action) VALUES
('refunds.create', 'Create refund requests', 'refunds', 'create'),
('refunds.approve', 'Approve refunds', 'refunds', 'approve'),
('reports.custom', 'Create custom reports', 'reports', 'create')
ON CONFLICT (name) DO NOTHING;

-- Assign to roles
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name IN ('refunds.create', 'refunds.approve', 'reports.custom')
ON CONFLICT DO NOTHING;
```

### Step 3: Update Permission Matrix

**File:** `src/services/rbac.service.ts`

```typescript
admin: {
  // ... existing permissions ...
  refunds: ['create', 'approve'],
  reports: ['view', 'export', 'create'],  // Add 'create' action
},
```

---

## Method 3: Give Individual Users Custom Permissions

You can override permissions for specific users by modifying the permission check.

### Option A: Add Custom Permissions Field

Add a JSONB field to store custom permissions per user:

**SQL:**
```sql
ALTER TABLE user_profiles 
ADD COLUMN custom_permissions JSONB DEFAULT '{}';

-- Example: Give a user extra permissions
UPDATE user_profiles 
SET custom_permissions = '{"refunds": ["approve"], "analytics": ["export"]}'::jsonb
WHERE email = 'special.user@zumbaton.com';
```

**TypeScript:**
```typescript
// In rbac.service.ts - merge custom permissions
export async function getUserPermissions(userId: string) {
  const rolePermissions = getRolePermissions(role);
  const { data: profile } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('custom_permissions')
    .eq('id', userId)
    .single();
  
  // Merge role permissions with custom permissions
  return mergePermissions(rolePermissions, profile.custom_permissions);
}
```

### Option B: Create Custom Roles

Give users a custom role with specific permissions:

```sql
-- Create custom role
UPDATE user_profiles 
SET role = 'admin', 
    preferences = jsonb_set(
      preferences, 
      '{custom_permissions}', 
      '["refunds.approve", "analytics.export"]'::jsonb
    )
WHERE email = 'special.user@zumbaton.com';
```

---

## Current Available Permissions

### Resources:
- `users` - User management
- `packages` - Package management
- `classes` - Class management
- `bookings` - Booking management
- `attendance` - Attendance tracking
- `tokens` - Token management
- `analytics` - Analytics & reports
- `settings` - System settings

### Actions:
- `view_all` - View all items
- `view_own` - View own items
- `create` - Create new items
- `edit_all` - Edit all items
- `edit_own` - Edit own items
- `delete` - Delete items
- `cancel_all` - Cancel any booking
- `cancel_own` - Cancel own bookings
- `purchase` - Purchase packages
- `check_in` - Mark attendance
- `mark_no_show` - Mark no-shows
- `adjust` - Adjust tokens
- `view` - Basic view access
- `export` - Export data
- `system` - System settings
- `gym` - Gym settings
- `change_role` - Change user roles

---

## Quick Examples

### Give receptionist ability to create packages:

```typescript
receptionist: {
  // ... existing ...
  packages: ['view', 'create'],  // Add 'create'
}
```

### Give instructor ability to view all bookings:

```typescript
instructor: {
  // ... existing ...
  bookings: ['view_all', 'view_own', 'cancel_own'],  // Add 'view_all'
}
```

### Add new "refund" permission to admin:

```typescript
admin: {
  // ... existing ...
  refunds: ['create', 'approve'],  // New resource
}
```

---

## Summary

✅ **Modify existing role permissions** - Edit `PERMISSION_MATRIX`  
✅ **Add new permissions** - Update types, database, and matrix  
✅ **Give individual users custom permissions** - Use JSONB field or custom logic  

The system is **very flexible**! You can customize permissions exactly how you want. 🎯

