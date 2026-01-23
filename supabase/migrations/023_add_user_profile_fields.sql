-- =====================================================
-- MIGRATION: Add blood_group and physical_form_url to user_profiles
-- Adds fields needed for user creation from admin panel
-- =====================================================

-- Add blood_group field
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);

-- Add physical_form_url field for storing uploaded physical form document
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS physical_form_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.blood_group IS 'User blood group (e.g., A+, B-, O+, AB+)';
COMMENT ON COLUMN user_profiles.physical_form_url IS 'URL to uploaded physical form document';

-- Create index for blood_group if needed for filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_blood_group ON user_profiles(blood_group) WHERE blood_group IS NOT NULL;
