-- Migration: Allow trial booking token transactions
-- Makes user_id nullable in token_transactions so trial guests (without accounts)
-- can have a 1-token record inserted for QR attendance scanning.
-- Also adds 'trial-booking-purchase' as a valid transaction type.

-- 1. Drop the NOT NULL constraint on user_id
ALTER TABLE token_transactions
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop the old CHECK constraint on transaction_type and recreate it with the new value
ALTER TABLE token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'purchase',
    'booking-hold',
    'booking-release',
    'attendance-consume',
    'no-show-consume',
    'late-cancel-consume',
    'admin-adjust',
    'refund',
    'expire',
    'trial-booking-purchase'
  ));

-- 3. Add a guest_booking_id column so trial transactions can be linked to their booking
--    (the booking_id column already exists from the original schema - just clarifying its use)
-- No change needed for booking_id column, it's already there and nullable.
