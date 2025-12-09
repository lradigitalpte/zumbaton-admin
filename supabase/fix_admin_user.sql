-- Fix admin user role
-- This updates the user profile for admin@gmail.com to have super_admin role

-- First, ensure the user_profiles entry exists
INSERT INTO user_profiles (id, email, name, role, is_active)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1), 'Admin User'),
    'super_admin',
    true
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    email = EXCLUDED.email,
    is_active = true,
    updated_at = NOW();

-- Verify the update
SELECT id, email, name, role, is_active, created_at, updated_at
FROM user_profiles
WHERE email = 'admin@gmail.com';

