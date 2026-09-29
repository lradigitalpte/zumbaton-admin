-- ROLLBACK for: migrations/20260929_consume_tokens_at_booking.sql
-- Run manually in Supabase Dashboard → SQL Editor only if you roll the code back too.
-- Do NOT add this file to supabase/migrations (would run on db push).
-- The 'booking-consume' type is left in place: rows written with it must stay valid.

DROP POLICY IF EXISTS "Admins can create user packages" ON user_packages;
DROP POLICY IF EXISTS "Admins can update user packages" ON user_packages;
DROP POLICY IF EXISTS "Admins can create bookings" ON bookings;

CREATE POLICY "System can create user packages"
  ON user_packages FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin_or_above(auth.uid()));

CREATE POLICY "System can update user packages"
  ON user_packages FOR UPDATE
  USING (user_id = auth.uid() OR is_admin_or_above(auth.uid()));

CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  USING (user_id = auth.uid());
