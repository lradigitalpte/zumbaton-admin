-- Script to create the first super_admin user
-- Run this in Supabase SQL Editor after running the main schema
-- 
-- IMPORTANT: Replace the placeholder values below:
-- - Replace 'admin@zumbaton.com' with your desired admin email
-- - Replace 'YourSecurePassword123!' with a strong password
-- - Replace 'Super Admin' with the admin's name

DO $$
DECLARE
    admin_email TEXT := 'admin@zumbaton.com';  -- CHANGE THIS
    admin_password TEXT := 'YourSecurePassword123!';  -- CHANGE THIS
    admin_name TEXT := 'Super Admin';  -- CHANGE THIS
    new_user_id UUID;
BEGIN
    -- Create auth user using Supabase Auth admin API
    -- Note: This requires using the Supabase Admin API, not SQL
    -- So we'll create it via a function that can be called from application code
    
    RAISE NOTICE 'To create super_admin user, you need to:';
    RAISE NOTICE '1. Use Supabase Admin API to create the auth user';
    RAISE NOTICE '2. Then run the SQL below to set the role';
    RAISE NOTICE '';
    RAISE NOTICE 'Or use the Node.js script: create_super_admin.js';
    
END $$;

-- After creating the user via Admin API, run this to set the role:
-- UPDATE user_profiles 
-- SET role = 'super_admin'
-- WHERE email = 'admin@zumbaton.com';

-- Or insert directly if user exists:
-- INSERT INTO user_profiles (id, email, name, role)
-- SELECT id, email, 'Super Admin', 'super_admin'
-- FROM auth.users
-- WHERE email = 'admin@zumbaton.com'
-- ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

