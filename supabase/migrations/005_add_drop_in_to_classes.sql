-- Migration: Add drop-in/walk-in support to classes
-- This allows classes to accept walk-in attendance without pre-booking

-- Add allow_drop_in column to classes table
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS allow_drop_in BOOLEAN DEFAULT false;

-- Add drop_in_token_cost column (can be different from regular token_cost)
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS drop_in_token_cost INTEGER DEFAULT NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN classes.allow_drop_in IS 'If true, users can check-in via QR without a prior booking';
COMMENT ON COLUMN classes.drop_in_token_cost IS 'Token cost for walk-in attendance (null = use regular token_cost)';

-- Create index for drop-in classes lookup
CREATE INDEX IF NOT EXISTS idx_classes_drop_in ON classes(allow_drop_in) WHERE allow_drop_in = true;
