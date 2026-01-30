-- Migration: Add guardian_email to user_profiles for child accounts
-- When set, payment receipts and payment-provider communications use this email (parent/guardian)
-- so the parent receives receipts instead of the child's plus-addressed auth email.

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(255);

COMMENT ON COLUMN user_profiles.guardian_email IS 'Parent/guardian email for child accounts; used for payment receipts and payment provider (e.g. HitPay) so parent receives receipts.';

CREATE INDEX IF NOT EXISTS idx_user_profiles_guardian_email
ON user_profiles(guardian_email)
WHERE guardian_email IS NOT NULL;
