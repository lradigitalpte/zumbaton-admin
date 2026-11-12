-- Self-serve child signups stay inactive until an admin confirms the account.
-- guardian_email already exists (20260131). Name and phone are collected on onboarding.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS child_review_pending BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_profiles.guardian_name IS 'Parent or guardian name for a self-registered child account.';
COMMENT ON COLUMN user_profiles.guardian_phone IS 'Parent or guardian phone for a self-registered child account.';
COMMENT ON COLUMN user_profiles.child_review_pending IS 'Member confirmed they are under 13. Account stays inactive until an admin reactivates it.';

CREATE INDEX IF NOT EXISTS idx_user_profiles_child_review
  ON user_profiles (child_review_pending)
  WHERE child_review_pending = true;

-- The stats view freezes user_profiles columns at create time (up.*).
-- Rebuild it so guardian fields and child_review_pending reach the Users page.
DROP VIEW IF EXISTS user_profiles_with_stats;

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

REVOKE ALL ON user_profiles_with_stats FROM anon, authenticated;
GRANT SELECT ON user_profiles_with_stats TO service_role;
