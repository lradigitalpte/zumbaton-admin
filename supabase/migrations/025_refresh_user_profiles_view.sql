-- =====================================================
-- MIGRATION: Refresh user_profiles_with_stats view to include new fields
-- This ensures date_of_birth, blood_group, physical_form_url, and early_bird fields are included
-- =====================================================

-- Drop the existing view first to avoid column position conflicts
-- This is necessary when changing the column structure
DROP VIEW IF EXISTS user_profiles_with_stats CASCADE;

-- Recreate the view with all columns explicitly listed
-- This ensures all new fields are included and avoids any conflicts
CREATE VIEW user_profiles_with_stats AS
SELECT 
  up.id,
  up.email,
  up.name,
  up.phone,
  up.avatar_url,
  up.role,
  up.is_active,
  up.no_show_count,
  up.is_flagged,
  up.preferences,
  up.created_at,
  up.updated_at,
  up.date_of_birth,
  up.blood_group,
  up.physical_form_url,
  up.early_bird_eligible,
  up.early_bird_granted_at,
  up.early_bird_expires_at,
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
