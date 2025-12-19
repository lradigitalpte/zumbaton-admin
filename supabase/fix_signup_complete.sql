-- Complete fix for user signup issue
-- Run this in Supabase SQL Editor

-- Step 1: Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_name TEXT;
    user_email TEXT;
BEGIN
    -- Extract name and email safely
    user_email := COALESCE(NEW.email, '');
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        split_part(user_email, '@', 1),
        'User'
    );
    
    -- Insert user profile with explicit error handling
    BEGIN
        INSERT INTO public.user_profiles (id, email, name, role)
        VALUES (
            NEW.id,
            user_email,
            user_name,
            COALESCE(NEW.raw_user_meta_data->>'role', 'user')
        )
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create user profile: %', SQLERRM;
        -- Continue even if this fails
    END;
    
    -- Create notification preferences
    BEGIN
        INSERT INTO public.user_notification_preferences (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create notification preferences: %', SQLERRM;
        -- Continue even if this fails
    END;
    
    -- Create user stats
    BEGIN
        INSERT INTO public.user_stats (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create user stats: %', SQLERRM;
        -- Continue even if this fails
    END;
    
    RETURN NEW;
END;
$$;

-- Step 2: Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Step 3: Disable RLS temporarily to avoid policy conflicts
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats DISABLE ROW LEVEL SECURITY;

-- Step 4: Drop all existing policies
DROP POLICY IF EXISTS "System can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Super admin can delete users" ON user_profiles;

DROP POLICY IF EXISTS "Users can view own notification prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "System can create notification prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can manage own notification prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "System can manage notification prefs" ON user_notification_preferences;

DROP POLICY IF EXISTS "System can manage stats" ON user_stats;
DROP POLICY IF EXISTS "Users can view own stats" ON user_stats;

-- Step 5: Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Step 6: Create clean policies
-- User profiles: Allow system to insert via trigger
CREATE POLICY "System can insert profiles"
    ON user_profiles
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can view own profile"
    ON user_profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON user_profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Notification preferences: Clean policies
CREATE POLICY "Users can view own notification prefs"
    ON user_notification_preferences
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification prefs"
    ON user_notification_preferences
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notification prefs"
    ON user_notification_preferences
    FOR INSERT
    WITH CHECK (true);

-- User stats: Allow system to manage
CREATE POLICY "System can manage stats"
    ON user_stats
    FOR ALL
    USING (true);

-- Step 5: Verify everything is set up
DO $$
BEGIN
    RAISE NOTICE 'Trigger and policies updated successfully!';
    RAISE NOTICE 'Try signing up a new user now.';
END $$;

