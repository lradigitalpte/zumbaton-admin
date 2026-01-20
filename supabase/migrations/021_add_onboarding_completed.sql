-- Migration: Add onboarding completion tracking to user_profiles
-- This ensures onboarding status persists across devices and sessions

-- Add onboarding_completed column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_completed 
ON user_profiles(onboarding_completed) 
WHERE onboarding_completed = true;

-- Add comment
COMMENT ON COLUMN user_profiles.onboarding_completed IS 'Whether the user has completed the onboarding tour';
