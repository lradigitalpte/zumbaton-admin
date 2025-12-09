-- Debug script to check trigger function and policies
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 2. Check the trigger function definition
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'handle_new_user';

-- 3. Check RLS policies on user_profiles
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_profiles';

-- 4. Check RLS policies on user_notification_preferences
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_notification_preferences';

-- 5. Check RLS policies on user_stats
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_stats';

-- 6. Test the trigger function manually (replace with a test UUID)
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_email TEXT := 'test@example.com';
BEGIN
    -- Simulate what the trigger does
    BEGIN
        INSERT INTO public.user_profiles (id, email, name, role)
        VALUES (test_user_id, test_email, 'Test User', 'user');
        
        INSERT INTO public.user_notification_preferences (user_id)
        VALUES (test_user_id);
        
        INSERT INTO public.user_stats (user_id)
        VALUES (test_user_id);
        
        RAISE NOTICE 'Success: All inserts worked';
        
        -- Cleanup
        DELETE FROM public.user_stats WHERE user_id = test_user_id;
        DELETE FROM public.user_notification_preferences WHERE user_id = test_user_id;
        DELETE FROM public.user_profiles WHERE id = test_user_id;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error: % - %', SQLSTATE, SQLERRM;
    END;
END $$;

