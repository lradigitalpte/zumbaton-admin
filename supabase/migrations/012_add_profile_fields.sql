-- Migration: Add additional profile fields to user_profiles
-- This migration adds fields for date_of_birth, emergency contacts, and bio

-- Add new profile fields
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.date_of_birth IS 'User date of birth';
COMMENT ON COLUMN user_profiles.emergency_contact_name IS 'Emergency contact person name';
COMMENT ON COLUMN user_profiles.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN user_profiles.bio IS 'User biography/description';

