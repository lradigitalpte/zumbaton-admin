-- Migration: Sync user_profiles.role to auth.users.raw_user_meta_data
-- This ensures the role is always available in the JWT token for fast auth checks
-- without needing to query the user_profiles table (which can cause RLS circular dependency)

-- =====================================================
-- FUNCTION: Sync role to user metadata
-- Called by trigger whenever user_profiles is inserted or updated
-- =====================================================
CREATE OR REPLACE FUNCTION sync_role_to_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the auth.users raw_user_meta_data with the role and name
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', NEW.role,
      'name', NEW.name
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Sync role on INSERT or UPDATE
-- =====================================================
DROP TRIGGER IF EXISTS sync_role_to_metadata_trigger ON user_profiles;

CREATE TRIGGER sync_role_to_metadata_trigger
  AFTER INSERT OR UPDATE OF role, name ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_to_user_metadata();

-- =====================================================
-- BACKFILL: Sync existing users
-- This updates all existing users to have their role in metadata
-- =====================================================
DO $$
DECLARE
  profile RECORD;
BEGIN
  FOR profile IN SELECT id, name, role FROM user_profiles
  LOOP
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'role', profile.role,
        'name', profile.name
      )
    WHERE id = profile.id;
  END LOOP;
  
  RAISE NOTICE 'Synced role metadata for all existing users';
END $$;

-- =====================================================
-- FUNCTION: Create user profile on signup
-- This is called when a new user signs up via auth
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into user_profiles with default role 'user'
  -- The role can be updated later by an admin
  INSERT INTO user_profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, user_profiles.name),
    updated_at = NOW();
  
  -- Ensure the role is synced back to metadata
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
      'name', COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Create profile on new user signup
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- Grant necessary permissions
-- =====================================================
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT SELECT, UPDATE ON auth.users TO postgres;
