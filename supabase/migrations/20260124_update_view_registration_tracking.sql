-- Update user_profiles_with_stats view to include registration_form_sent_at
DROP VIEW IF EXISTS user_profiles_with_stats CASCADE;

CREATE VIEW user_profiles_with_stats AS
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
  utb.total_tokens as current_token_balance,
  utb.available_tokens as current_available_tokens
FROM user_profiles up
LEFT JOIN user_stats us ON up.id = us.user_id
LEFT JOIN user_token_balances utb ON up.id = utb.user_id;
