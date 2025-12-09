-- Fix for "Database error saving new user" issue
-- Run this in Supabase SQL Editor after running the main schema

-- First, drop existing policies that are blocking trigger inserts
DROP POLICY IF EXISTS "System can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can manage own notification prefs" ON user_notification_preferences;
DROP POLICY IF EXISTS "System can manage stats" ON user_stats;

-- Update user_profiles insert policy to allow trigger function
CREATE POLICY "System can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

-- Update notification preferences policies
CREATE POLICY "Users can update own notification prefs"
  ON user_notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow system to create notification preferences
CREATE POLICY "System can create notification prefs"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (true);

-- Update user_stats policy to allow system inserts
CREATE POLICY "System can manage stats"
  ON user_stats FOR ALL
  USING (true);

-- Update trigger function to be more robust
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user profile
  INSERT INTO public.user_profiles (id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, 'unknown@example.com'), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Create notification preferences
  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create user stats record
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

