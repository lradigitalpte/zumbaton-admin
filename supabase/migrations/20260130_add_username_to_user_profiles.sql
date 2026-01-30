-- Migration: Add username column to user_profiles for child/login-by-username support
-- Username is unique (when set) and used for sign-in when users share a parent email

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username
ON user_profiles(username)
WHERE username IS NOT NULL;

COMMENT ON COLUMN user_profiles.username IS 'Optional login username (e.g. for child accounts); used with sign-in when email is shared.';
