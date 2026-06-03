-- Add is_outdoor column to classes table
-- Default is false (indoor/studio), set to true for outdoor classes
-- Outdoor classes display with "(outdoors)" suffix on the website

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS is_outdoor BOOLEAN NOT NULL DEFAULT false;
