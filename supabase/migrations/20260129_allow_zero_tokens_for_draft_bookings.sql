-- =====================================================
-- Migration: Allow Zero tokens_used for Draft/Trial Bookings
-- Date: 2026-01-29
-- Description: Relax bookings_tokens_used_check so draft/guest
--               trial bookings can have tokens_used = 0 (no package).
-- =====================================================

-- Drop existing constraint (tokens_used > 0)
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_tokens_used_check;

-- Allow tokens_used >= 0 (0 for draft/trial, > 0 for member package bookings)
ALTER TABLE bookings
ADD CONSTRAINT bookings_tokens_used_check CHECK (tokens_used >= 0);

COMMENT ON COLUMN bookings.tokens_used IS 'Tokens deducted from package; 0 for trial/draft guest bookings, >= 1 for member bookings.';
