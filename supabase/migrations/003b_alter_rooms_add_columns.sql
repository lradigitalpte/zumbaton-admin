-- =====================================================
-- MIGRATION: Add missing columns to rooms table
-- Run this in Supabase SQL Editor
-- This is a follow-up migration if you already ran 003
-- =====================================================

-- Add room_type column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rooms' AND column_name = 'room_type'
  ) THEN
    ALTER TABLE rooms ADD COLUMN room_type VARCHAR(30) DEFAULT 'studio';
    ALTER TABLE rooms ADD CONSTRAINT rooms_room_type_check 
      CHECK (room_type IN ('studio', 'outdoor', 'pool', 'gym', 'other'));
  END IF;
END $$;

-- Add status column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rooms' AND column_name = 'status'
  ) THEN
    ALTER TABLE rooms ADD COLUMN status VARCHAR(20) DEFAULT 'available';
    ALTER TABLE rooms ADD CONSTRAINT rooms_status_check 
      CHECK (status IN ('available', 'maintenance', 'inactive'));
  END IF;
END $$;

-- Add color column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rooms' AND column_name = 'color'
  ) THEN
    ALTER TABLE rooms ADD COLUMN color VARCHAR(20) DEFAULT 'amber';
  END IF;
END $$;

-- Update existing rooms with default values
UPDATE rooms SET 
  room_type = COALESCE(room_type, 'studio'),
  status = COALESCE(status, 'available'),
  color = COALESCE(color, 'amber')
WHERE room_type IS NULL OR status IS NULL OR color IS NULL;

-- Verify the columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'rooms' 
AND column_name IN ('room_type', 'status', 'color');
