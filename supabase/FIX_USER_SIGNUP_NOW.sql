-- URGENT FIX: Run this immediately in Supabase SQL Editor
-- This will fix the "Database error saving new user" issue

-- Step 1: Temporarily disable RLS to allow trigger function to work
-- We'll re-enable it after fixing policies

ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats DISABLE ROW LEVEL SECURITY;

-- Step 2: Recreate trigger function with proper error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert user profile
    INSERT INTO public.user_profiles (id, email, name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(
            NEW.raw_user_meta_data->>'name',
            split_part(COALESCE(NEW.email, 'unknown@example.com'), '@', 1)
        ),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Create notification preferences
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create user stats
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Step 3: Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Step 4: Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop all existing policies and recreate them properly
DROP POLICY IF EXISTS "System can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Super admin can delete users" ON user_profiles;

-- Recreate user_profiles policies
CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON user_profiles FOR SELECT
    USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND 
        role = (SELECT role FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins can update any profile"
    ON user_profiles FOR UPDATE
    USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Super admin can delete users"
    ON user_profiles FOR DELETE
    USING (is_super_admin(auth.uid()));

-- This is the critical policy - must allow system inserts
CREATE POLICY "System can insert profiles"
    ON user_profiles FOR INSERT
    WITH CHECK (true);

-- Fix notification preferences policies
DROP POLICY IF EXISTS "Users can view own notification prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "System can create notification prefs" ON user_notification_preferences;

CREATE POLICY "Users can view own notification prefs"
    ON user_notification_preferences FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification prefs"
    ON user_notification_preferences FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notification prefs"
    ON user_notification_preferences FOR INSERT
    WITH CHECK (true);

-- Fix user_stats policies
DROP POLICY IF EXISTS "Users can view own stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can view all stats" ON user_stats;
DROP POLICY IF EXISTS "System can manage stats" ON user_stats;

CREATE POLICY "Users can view own stats"
    ON user_stats FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all stats"
    ON user_stats FOR SELECT
    USING (is_admin_or_above(auth.uid()));

CREATE POLICY "System can manage stats"
    ON user_stats FOR ALL
    USING (true);

-- Done!
SELECT 'Fix applied successfully! Try signing up now.' AS message;

