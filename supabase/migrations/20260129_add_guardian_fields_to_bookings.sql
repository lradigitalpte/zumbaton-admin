-- =====================================================
-- Migration: Add Guardian Fields for Kids Classes
-- Date: 2026-01-29
-- Description: Add guardian/parent information fields for kids class bookings
-- =====================================================

-- Add guardian information fields for kids class bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS guardian_on_premises BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN bookings.guardian_name IS 'Name of parent/guardian for kids class bookings';
COMMENT ON COLUMN bookings.guardian_email IS 'Email of parent/guardian for kids class bookings';
COMMENT ON COLUMN bookings.guardian_phone IS 'Phone number of parent/guardian for kids class bookings';
COMMENT ON COLUMN bookings.guardian_on_premises IS 'Confirmation that parent/guardian will be on premises during the class';

-- Add index for guardian email lookups
CREATE INDEX IF NOT EXISTS idx_bookings_guardian_email ON bookings(guardian_email) WHERE guardian_email IS NOT NULL;
