-- Migration: Enhance notification preferences to support granular per-notification-type settings
-- This allows users to configure email/push/sms for each specific notification type

-- Add granular preferences JSONB column to store per-notification-type settings
ALTER TABLE user_notification_preferences
ADD COLUMN IF NOT EXISTS granular_preferences JSONB DEFAULT '{}';

-- Create index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_notification_prefs_granular ON user_notification_preferences USING GIN (granular_preferences);

-- Update trigger to update updated_at
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notification_prefs_updated_at ON user_notification_preferences;
CREATE TRIGGER update_notification_prefs_updated_at
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Default granular preferences structure (for reference)
-- This will be stored in granular_preferences JSONB field:
-- {
--   "new_booking": { "email": true, "push": true, "sms": false },
--   "booking_cancelled": { "email": true, "push": true, "sms": false },
--   "waitlist_promotion": { "email": true, "push": true, "sms": false },
--   "no_show": { "email": true, "push": false, "sms": false },
--   "token_purchase": { "email": true, "push": true, "sms": false },
--   "low_token_alert": { "email": true, "push": false, "sms": false },
--   "token_expiry": { "email": true, "push": true, "sms": false },
--   "token_adjustment": { "email": true, "push": false, "sms": false },
--   "new_user": { "email": true, "push": false, "sms": false },
--   "flagged_user": { "email": true, "push": true, "sms": true },
--   "daily_summary": { "email": true, "push": false, "sms": false },
--   "weekly_report": { "email": true, "push": false, "sms": false }
-- }

