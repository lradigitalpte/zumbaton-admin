-- Alternative Method: Create Super Admin via SQL (No Service Role Key Needed)
-- Run this in Supabase SQL Editor
-- 
-- This creates a user via Supabase Auth Admin API call that you can make from the dashboard
-- OR you can manually create via Supabase Dashboard > Authentication > Users > Add User

-- Step 1: Create the user via Supabase Dashboard
-- Go to: Authentication > Users > Add User
-- Fill in:
--   Email: admin@zumbaton.com (or your email)
--   Password: YourSecurePassword123!
--   Auto Confirm User: YES (check the box)
-- Click "Create User"
--
-- Then note the User ID (UUID) that gets created

-- Step 2: After creating the user, update their profile to super_admin role
-- Replace 'USER_UUID_HERE' with the actual UUID from Step 1

-- Update existing profile if trigger created it
UPDATE user_profiles
SET role = 'super_admin',
    name = 'Super Admin',
    is_active = true
WHERE id = 'USER_UUID_HERE';

-- If profile doesn't exist, insert it
INSERT INTO user_profiles (id, email, name, role, is_active)
SELECT 
    id,
    email,
    'Super Admin',
    'super_admin',
    true
FROM auth.users
WHERE email = 'admin@zumbaton.com'
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin',
    name = 'Super Admin',
    is_active = true;

-- Ensure notification preferences exist
INSERT INTO user_notification_preferences (user_id, email_enabled, push_enabled)
SELECT id, true, true
FROM auth.users
WHERE email = 'admin@zumbaton.com'
ON CONFLICT (user_id) DO NOTHING;

-- Ensure user stats exist
INSERT INTO user_stats (user_id)
SELECT id
FROM auth.users
WHERE email = 'admin@zumbaton.com'
ON CONFLICT (user_id) DO NOTHING;

-- Verify the super_admin was created
SELECT 
    up.id,
    up.email,
    up.name,
    up.role,
    up.is_active,
    au.email_confirmed_at
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE up.email = 'admin@zumbaton.com';

