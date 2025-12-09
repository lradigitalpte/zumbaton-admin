-- Update your admin user to super_admin role
-- User ID: 744b6e0f-101d-4247-b432-4276fa0287f8
-- Email: admin@gmail.com

-- Update the user profile to super_admin role
UPDATE user_profiles
SET 
    role = 'super_admin',
    name = COALESCE(name, 'Super Admin'),
    is_active = true
WHERE id = '744b6e0f-101d-4247-b432-4276fa0287f8'
   OR email = 'admin@gmail.com';

-- If profile doesn't exist, create it
INSERT INTO user_profiles (id, email, name, role, is_active)
VALUES (
    '744b6e0f-101d-4247-b432-4276fa0287f8',
    'admin@gmail.com',
    'Super Admin',
    'super_admin',
    true
)
ON CONFLICT (id) DO UPDATE
SET 
    role = 'super_admin',
    name = 'Super Admin',
    is_active = true,
    email = 'admin@gmail.com';

-- Ensure notification preferences exist
INSERT INTO user_notification_preferences (user_id, email_enabled, push_enabled)
VALUES ('744b6e0f-101d-4247-b432-4276fa0287f8', true, true)
ON CONFLICT (user_id) DO UPDATE
SET email_enabled = true, push_enabled = true;

-- Ensure user stats exist
INSERT INTO user_stats (user_id)
VALUES ('744b6e0f-101d-4247-b432-4276fa0287f8')
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
WHERE up.id = '744b6e0f-101d-4247-b432-4276fa0287f8';

-- Expected result: Should show role = 'super_admin' and is_active = true

