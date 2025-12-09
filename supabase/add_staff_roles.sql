-- Add staff and receptionist roles to the database
-- Run this in Supabase SQL Editor if you want to add these roles

-- First, we need to update the CHECK constraints to allow new roles
-- Note: This requires dropping and recreating constraints

-- Step 1: Drop existing CHECK constraints
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE role_permissions 
DROP CONSTRAINT IF EXISTS role_permissions_role_check;

-- Step 2: Add new CHECK constraints with additional roles
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('super_admin', 'admin', 'instructor', 'staff', 'receptionist', 'user'));

ALTER TABLE role_permissions
ADD CONSTRAINT role_permissions_role_check 
CHECK (role IN ('super_admin', 'admin', 'instructor', 'staff', 'receptionist', 'user'));

-- Step 3: Update helper functions to include new roles
CREATE OR REPLACE FUNCTION is_staff_or_above(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role IN ('super_admin', 'admin', 'instructor', 'staff', 'receptionist') 
     FROM user_profiles WHERE id = user_id),
    false
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Step 4: Assign permissions to staff role
INSERT INTO role_permissions (role, permission_id)
SELECT 'staff', id FROM permissions 
WHERE name IN (
  'users.view_all', 'users.view_own', 'users.edit_all',
  'packages.view', 'packages.create',
  'classes.view', 'classes.create', 'classes.edit_all',
  'bookings.view_all', 'bookings.view_own', 'bookings.create', 'bookings.cancel_all', 'bookings.cancel_own',
  'attendance.view_all', 'attendance.view_own', 'attendance.check_in', 'attendance.mark_no_show',
  'tokens.view_all', 'tokens.view_own', 'tokens.adjust',
  'analytics.view'
)
ON CONFLICT DO NOTHING;

-- Step 5: Assign permissions to receptionist role
INSERT INTO role_permissions (role, permission_id)
SELECT 'receptionist', id FROM permissions 
WHERE name IN (
  'users.view_all', 'users.view_own',
  'packages.view',
  'classes.view',
  'bookings.view_all', 'bookings.view_own', 'bookings.create', 'bookings.cancel_all', 'bookings.cancel_own',
  'attendance.view_all', 'attendance.view_own', 'attendance.check_in', 'attendance.mark_no_show',
  'tokens.view_all', 'tokens.view_own'
)
ON CONFLICT DO NOTHING;

-- Step 6: Verify the changes
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass
  AND conname LIKE '%role%';

-- Check permissions assigned to new roles
SELECT 
    rp.role,
    p.name as permission,
    p.description
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
WHERE rp.role IN ('staff', 'receptionist')
ORDER BY rp.role, p.resource, p.action;

-- Expected: Should show role can be one of: super_admin, admin, instructor, staff, receptionist, user

