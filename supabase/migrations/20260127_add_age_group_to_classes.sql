-- =====================================================
-- Migration: Add age_group (target audience) to classes
-- Date: 2026-01-27
-- Description: Adds support for Adult/Kid/Both classes
-- =====================================================

-- Add age_group column to classes table
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS age_group VARCHAR(20) DEFAULT 'all' 
  CHECK (age_group IN ('adult', 'kid', 'all'));

-- Update existing classes to default to 'all' (both adults and kids)
UPDATE classes
SET age_group = 'all'
WHERE age_group IS NULL;

-- Make it NOT NULL with default
ALTER TABLE classes
ALTER COLUMN age_group SET DEFAULT 'all',
ALTER COLUMN age_group SET NOT NULL;

-- Add comment
COMMENT ON COLUMN classes.age_group IS 'Target audience: adult (13+), kid (<13), or all (both)';

-- Create index for filtering by age group
CREATE INDEX IF NOT EXISTS idx_classes_age_group ON classes(age_group);
