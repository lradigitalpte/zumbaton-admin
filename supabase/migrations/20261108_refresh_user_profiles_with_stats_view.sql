-- Rebuild user_profiles_with_stats so it includes columns added to user_profiles
-- after the view was created (notably signup_source, added in 20260624).
--
-- A Postgres view freezes `up.*` to the columns that existed when it was created,
-- so the admin Users page never received signup_source and the "Self-signup"
-- filter always showed 0. Definition below is identical to 20260610 otherwise.
--
-- Safe to re-run. No CASCADE: if anything ever depends on this view, the DROP
-- fails loudly instead of silently removing the dependent object.

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

-- Admin-only view: block direct PostgREST access from anon/authenticated JWTs.
REVOKE ALL ON user_profiles_with_stats FROM anon, authenticated;
GRANT SELECT ON user_profiles_with_stats TO service_role;
