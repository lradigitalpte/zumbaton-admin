-- SIMPLE METHOD: Create Super Admin User (No Service Role Key Needed)
-- 
-- This is the EASIEST way if you can't find the service role key
-- 
-- Steps:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" 
-- 3. Fill in:
--    - Email: admin@zumbaton.com (or your email)
--    - Password: YourSecurePassword123!
--    - Auto Confirm User: ✓ (IMPORTANT - check this box!)
-- 4. Click "Create User"
-- 5. Copy the User ID (UUID) shown
-- 6. Run the SQL below, replacing YOUR_EMAIL_HERE with your email

-- After creating user in Dashboard, run this SQL:

-- Update the user profile to super_admin role (works if trigger already created profile)
UPDATE user_profiles
SET 
    role = 'super_admin',
    name = COALESCE(name, 'Super Admin'),
    is_active = true
WHERE email = 'admin@zumbaton.com'  -- Replace with your email
   OR id IN (
       SELECT id FROM auth.users 
       WHERE email = 'admin@zumbaton.com'  -- Replace with your email
   );

-- If profile doesn't exist, create it
INSERT INTO user_profiles (id, email, name, role, is_active)
SELECT 
    id,
    email,
    'Super Admin',
    'super_admin',
    true
FROM auth.users
WHERE email = 'admin@zumbaton.com'  -- Replace with your email
  AND NOT EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.users.id
  )
ON CONFLICT (id) DO UPDATE
SET 
    role = 'super_admin',
    name = 'Super Admin',
    is_active = true;

-- Ensure notification preferences exist
INSERT INTO user_notification_preferences (user_id, email_enabled, push_enabled)
SELECT id, true, true
FROM auth.users
WHERE email = 'admin@zumbaton.com'  -- Replace with your email
ON CONFLICT (user_id) DO UPDATE
SET email_enabled = true, push_enabled = true;

-- Ensure user stats exist
INSERT INTO user_stats (user_id)
SELECT id
FROM auth.users
WHERE email = 'admin@zumbaton.com'  -- Replace with your email
ON CONFLICT (user_id) DO NOTHING;

-- Verify it worked
SELECT 
    up.id,
    up.email,
    up.name,
    up.role,
    up.is_active,
    CASE WHEN au.email_confirmed_at IS NOT NULL THEN 'Confirmed' ELSE 'Not Confirmed' END as email_status
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE up.email = 'admin@zumbaton.com';  -- Replace with your email

-- Expected result: Should show role = 'super_admin' and is_active = true

