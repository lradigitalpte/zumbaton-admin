-- Migration: Add gender column to user_profiles table
-- This allows storing gender information from registration forms

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

COMMENT ON COLUMN user_profiles.gender IS 'User gender (Male, Female, Not sure, etc.)';
