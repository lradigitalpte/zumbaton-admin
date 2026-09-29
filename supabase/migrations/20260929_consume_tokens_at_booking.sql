-- =====================================================
-- Migration: Tokens are consumed at booking time
-- =====================================================
-- 1. Adds the 'booking-consume' transaction type (token spent when a class is booked).
--    Cancellations by 23:59 the day before the class write a 'refund' row.
-- 2. Members can no longer change token balances or booking rows from the browser.
--    Booking, cancelling and refunds all run server-side with the service role
--    (which bypasses RLS). Before this, a member could edit their own
--    user_packages.tokens_remaining, or a booking's tokens_used and then cancel it
--    to be refunded tokens they never paid.
--
-- Run BEFORE deploying the consume-on-book code.
-- Rollback: supabase/rollbacks/20260929_consume_tokens_at_booking_ROLLBACK.sql
-- =====================================================

-- 1. Transaction type ---------------------------------------------------------

ALTER TABLE token_transactions
DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE token_transactions
ADD CONSTRAINT token_transactions_transaction_type_check
CHECK (transaction_type IN (
  'purchase', 'booking-consume', 'booking-hold', 'booking-release', 'attendance-consume',
  'no-show-consume', 'late-cancel-consume', 'admin-adjust', 'admin-sale',
  'refund', 'expire', 'trial-booking-purchase'
));

-- 2. Lock down member writes ----------------------------------------------------
-- Live policy names can differ from schema.sql, so match on what the policy checks:
-- drop every INSERT/UPDATE/ALL policy on these tables that lets a member act on
-- their own rows (user_id = auth.uid()) without an admin check.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('user_packages', 'bookings')
      AND cmd IN ('INSERT', 'UPDATE', 'ALL')
      AND coalesce(qual, '') || ' ' || coalesce(with_check, '') ILIKE '%auth.uid()%'
      AND coalesce(qual, '') || ' ' || coalesce(with_check, '') NOT ILIKE '%is_admin%'
      AND coalesce(qual, '') || ' ' || coalesce(with_check, '') NOT ILIKE '%instructor%'
  LOOP
    RAISE NOTICE 'Dropping member write policy % on %', pol.policyname, pol.tablename;
    EXECUTE format('DROP POLICY %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- The user_packages INSERT/UPDATE policies combined member and admin access
-- ("user_id = auth.uid() OR is_admin_or_above(...)"), so the loop above skips them.
-- Replace them with admin-only versions.
DROP POLICY IF EXISTS "System can create user packages" ON user_packages;
DROP POLICY IF EXISTS "System can update user packages" ON user_packages;

CREATE POLICY "Admins can create user packages"
  ON user_packages FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update user packages"
  ON user_packages FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

-- Admins already have "Admins can update all bookings"; add an admin INSERT policy
-- so admin screens that insert bookings directly keep working.
DROP POLICY IF EXISTS "Admins can create bookings" ON bookings;
CREATE POLICY "Admins can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()));

-- Show what's left, for the person running this
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('user_packages', 'bookings')
ORDER BY tablename, cmd, policyname;
