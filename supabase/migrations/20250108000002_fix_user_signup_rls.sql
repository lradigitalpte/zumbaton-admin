-- Fix RLS policies to allow user signup trigger to work
-- Migration: 20250108000002_fix_user_signup_rls.sql

-- Fix user_profiles insert policy to allow trigger function
DROP POLICY IF EXISTS "System can insert profiles" ON user_profiles;
CREATE POLICY "System can insert profiles"
    ON user_profiles FOR INSERT
    WITH CHECK (true);

-- Fix notification preferences policies
DROP POLICY IF EXISTS "Users can manage own notification prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "System can create notification prefs" ON user_notification_preferences;

CREATE POLICY "Users can update own notification prefs"
    ON user_notification_preferences FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notification prefs"
    ON user_notification_preferences FOR INSERT
    WITH CHECK (true);

-- Fix user_stats policy
DROP POLICY IF EXISTS "System can manage stats" ON user_stats;
CREATE POLICY "System can manage stats"
    ON user_stats FOR ALL
    USING (true);

-- Recreate trigger function with proper error handling
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
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

