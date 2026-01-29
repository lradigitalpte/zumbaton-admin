-- =====================================================
-- Migration: Add Draft Status to Bookings
-- Date: 2026-01-29
-- Description: Adds 'draft' status for incomplete trial bookings (leads)
-- =====================================================

-- Drop existing status constraint
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Add new constraint with 'draft' status
ALTER TABLE bookings
ADD CONSTRAINT bookings_status_check 
CHECK (status IN ('draft', 'confirmed', 'waitlist', 'cancelled', 'cancelled-late', 'attended', 'no-show'));

-- Add index for draft bookings (for admin lead tracking)
CREATE INDEX IF NOT EXISTS idx_bookings_draft ON bookings(status) WHERE status = 'draft';

-- Add comment
COMMENT ON COLUMN bookings.status IS 'Booking status: draft (incomplete/pending payment), confirmed, waitlist, cancelled, cancelled-late, attended, no-show';
