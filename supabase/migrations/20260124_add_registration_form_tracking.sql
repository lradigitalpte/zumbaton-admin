-- Add tracking for registration form link sending
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS registration_form_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.registration_form_sent_at IS 'When the registration form link was sent to the user';
