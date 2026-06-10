-- Fix Supabase linter: security definer views + RLS on sensitive tables.
-- App APIs use service_role (bypasses RLS); views use security_invoker so caller RLS applies.
--
-- ROLLBACK: If anything breaks after applying, run manually in SQL Editor (NOT via db push):
--   supabase/rollbacks/20260610_fix_security_views_and_rls_ROLLBACK.sql

-- =====================================================
-- 1. VIEWS: security_invoker = true
-- =====================================================

DROP VIEW IF EXISTS user_profiles_with_stats CASCADE;

DROP VIEW IF EXISTS user_token_balances CASCADE;
CREATE VIEW user_token_balances
WITH (security_invoker = true)
AS
SELECT
  user_id,
  SUM(tokens_remaining) AS total_tokens,
  SUM(tokens_held) AS held_tokens,
  SUM(tokens_remaining) - SUM(tokens_held) AS available_tokens,
  MIN(expires_at) AS next_expiry,
  COUNT(*) AS active_packages
FROM user_packages
WHERE status = 'active' AND expires_at > NOW()
GROUP BY user_id;

CREATE VIEW user_profiles_with_stats
WITH (security_invoker = true)
AS
SELECT
  up.*,
  us.total_classes_attended,
  us.total_classes_booked,
  us.total_no_shows,
  us.total_tokens_purchased,
  us.total_tokens_used,
  us.total_spent_cents,
  us.streak_current,
  us.streak_longest,
  us.last_class_at,
  utb.total_tokens AS current_token_balance,
  utb.available_tokens AS current_available_tokens
FROM user_profiles up
LEFT JOIN user_stats us ON up.id = us.user_id
LEFT JOIN user_token_balances utb ON up.id = utb.user_id;

DROP VIEW IF EXISTS upcoming_classes_summary CASCADE;
CREATE VIEW upcoming_classes_summary
WITH (security_invoker = true)
AS
SELECT
  c.*,
  COUNT(b.id) FILTER (WHERE b.status = 'confirmed') AS booked_count,
  c.capacity - COUNT(b.id) FILTER (WHERE b.status = 'confirmed') AS spots_available,
  COUNT(w.id) FILTER (WHERE w.status = 'waiting') AS waitlist_count
FROM classes c
LEFT JOIN bookings b ON c.id = b.class_id
LEFT JOIN waitlist w ON c.id = w.class_id
WHERE c.scheduled_at > NOW() AND c.status = 'scheduled'
GROUP BY c.id
ORDER BY c.scheduled_at;

DROP VIEW IF EXISTS admin_dashboard_metrics CASCADE;
CREATE VIEW admin_dashboard_metrics
WITH (security_invoker = true)
AS
SELECT
  (SELECT COUNT(*) FROM user_profiles WHERE is_active = true) AS total_active_users,
  (SELECT COUNT(*) FROM user_profiles WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
  (SELECT COUNT(*) FROM classes WHERE scheduled_at > NOW() AND status = 'scheduled') AS upcoming_classes,
  (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS active_bookings,
  (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status = 'succeeded' AND created_at > NOW() - INTERVAL '30 days') AS revenue_30d_cents,
  (SELECT COUNT(*) FROM payments WHERE status = 'succeeded' AND created_at > NOW() - INTERVAL '30 days') AS transactions_30d;

DROP VIEW IF EXISTS rooms_with_usage CASCADE;
CREATE VIEW rooms_with_usage
WITH (security_invoker = true)
AS
SELECT
  r.*,
  COUNT(c.id) FILTER (WHERE c.status = 'scheduled' AND c.scheduled_at > NOW()) AS upcoming_classes
FROM rooms r
LEFT JOIN classes c ON r.id = c.room_id
GROUP BY r.id;

DROP VIEW IF EXISTS categories_with_usage CASCADE;
CREATE VIEW categories_with_usage
WITH (security_invoker = true)
AS
SELECT
  cc.*,
  COUNT(c.id) AS total_classes,
  COUNT(c.id) FILTER (WHERE c.status = 'scheduled' AND c.scheduled_at > NOW()) AS upcoming_classes
FROM class_categories cc
LEFT JOIN classes c ON cc.id = c.category_id
GROUP BY cc.id;

DROP VIEW IF EXISTS user_no_show_counts CASCADE;
CREATE VIEW user_no_show_counts
WITH (security_invoker = true)
AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE issue_type = 'no-show') AS no_show_count,
  COUNT(*) FILTER (WHERE issue_type = 'late-cancel') AS late_cancel_count,
  COUNT(*) FILTER (WHERE status = 'penalized') AS penalized_count
FROM attendance_issues
GROUP BY user_id;

-- Admin-only views: block direct PostgREST access from anon/authenticated JWTs.
REVOKE ALL ON user_profiles_with_stats FROM anon, authenticated;
REVOKE ALL ON user_token_balances FROM anon, authenticated;
REVOKE ALL ON admin_dashboard_metrics FROM anon, authenticated;
REVOKE ALL ON user_no_show_counts FROM anon, authenticated;

GRANT SELECT ON user_profiles_with_stats TO service_role;
GRANT SELECT ON user_token_balances TO service_role;
GRANT SELECT ON admin_dashboard_metrics TO service_role;
GRANT SELECT ON user_no_show_counts TO service_role;

-- =====================================================
-- 2. RLS: referral_vouchers, announcements, password_reset_otps
-- =====================================================

ALTER TABLE referral_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own referral vouchers"
  ON referral_vouchers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff manage referral vouchers"
  ON referral_vouchers FOR ALL
  TO authenticated
  USING (is_admin_or_above(auth.uid()))
  WITH CHECK (is_admin_or_above(auth.uid()));

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active announcements"
  ON announcements FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Staff manage announcements"
  ON announcements FOR ALL
  TO authenticated
  USING (is_admin_or_above(auth.uid()))
  WITH CHECK (is_admin_or_above(auth.uid()));

ALTER TABLE password_reset_otps ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: only service_role (API routes) may access OTP rows.
