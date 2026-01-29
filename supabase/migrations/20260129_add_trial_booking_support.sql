-- =====================================================
-- Migration: Add Trial Booking Support
-- Date: 2026-01-29
-- Description: Allows guest bookings (trial classes) without user accounts
-- =====================================================

-- Add trial pricing to classes table
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS trial_price_cents INTEGER CHECK (trial_price_cents > 0);

-- Add comment
COMMENT ON COLUMN classes.trial_price_cents IS 'Price in cents for trial class booking. If NULL, class cannot be booked as trial.';

-- Make user_id nullable in bookings table for guest bookings
ALTER TABLE bookings
ALTER COLUMN user_id DROP NOT NULL;

-- Add guest information fields for trial bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS guest_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS guest_date_of_birth DATE,
ADD COLUMN IF NOT EXISTS is_trial_booking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

-- Add constraint: either user_id OR guest_email must be present
-- Drop constraint if it exists first
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_user_or_guest_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_user_or_guest_check 
CHECK (
  (user_id IS NOT NULL) OR 
  (guest_email IS NOT NULL AND guest_name IS NOT NULL)
);

-- Add index for guest bookings lookup
CREATE INDEX IF NOT EXISTS idx_bookings_guest_email ON bookings(guest_email) WHERE guest_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_trial ON bookings(is_trial_booking) WHERE is_trial_booking = true;
CREATE INDEX IF NOT EXISTS idx_bookings_payment ON bookings(payment_id) WHERE payment_id IS NOT NULL;

-- Make user_id nullable in payments table for trial bookings
ALTER TABLE payments
ALTER COLUMN user_id DROP NOT NULL;

-- Add class_id to payments table for trial bookings
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_trial_booking BOOLEAN DEFAULT false;

-- Add constraint: either user_id OR (is_trial_booking with class_id) must be present
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_user_or_trial_check;

ALTER TABLE payments
ADD CONSTRAINT payments_user_or_trial_check 
CHECK (
  (user_id IS NOT NULL) OR 
  (is_trial_booking = true AND class_id IS NOT NULL)
);

-- Add index for payments by class
CREATE INDEX IF NOT EXISTS idx_payments_class ON payments(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_trial ON payments(is_trial_booking) WHERE is_trial_booking = true;

-- Add comment
COMMENT ON COLUMN bookings.is_trial_booking IS 'True if this is a trial class booking (guest booking without user account)';
COMMENT ON COLUMN payments.is_trial_booking IS 'True if this payment is for a trial class booking';
