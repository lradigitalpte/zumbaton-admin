-- Migration: Add privacy settings columns to user_profiles
-- This migration adds columns for user privacy preferences

-- Add privacy settings columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS show_profile BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_stats BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.show_profile IS 'Allow other members to see your profile';
COMMENT ON COLUMN user_profiles.show_stats IS 'Display your attendance stats publicly';

-- Create index for privacy settings queries if needed
CREATE INDEX IF NOT EXISTS idx_user_profiles_show_profile ON user_profiles(show_profile) WHERE show_profile = true;
CREATE INDEX IF NOT EXISTS idx_user_profiles_show_stats ON user_profiles(show_stats) WHERE show_stats = true;

