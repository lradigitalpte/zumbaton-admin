-- Add missing early bird columns to user_profiles
-- Date: 2026-01-18
-- Description: Add early_bird_granted_at and early_bird_expires_at columns

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS early_bird_granted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS early_bird_expires_at TIMESTAMPTZ;

-- Update existing early bird eligible users to have expiry dates (2 months from now)
UPDATE user_profiles 
SET 
  early_bird_granted_at = NOW(),
  early_bird_expires_at = NOW() + INTERVAL '2 months'
WHERE early_bird_eligible = true 
AND early_bird_expires_at IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_early_bird_expires ON user_profiles(early_bird_expires_at) WHERE early_bird_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_early_bird_granted ON user_profiles(early_bird_granted_at) WHERE early_bird_granted_at IS NOT NULL;