-- =====================================================
-- Migration: Add Password Reset OTP System
-- Date: 2025-01-12
-- Description: Adds OTP-based password reset flow
-- =====================================================

-- =====================================================
-- PASSWORD_RESET_OTPS TABLE
-- Stores OTP codes for password reset
-- =====================================================
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure OTP is 6 digits
  CONSTRAINT otp_code_format CHECK (otp_code ~ '^[0-9]{6}$')
);

-- Indexes for OTP lookups
CREATE INDEX idx_password_reset_otps_email ON password_reset_otps(email);
CREATE INDEX idx_password_reset_otps_user ON password_reset_otps(user_id);
CREATE INDEX idx_password_reset_otps_code ON password_reset_otps(otp_code);
CREATE INDEX idx_password_reset_otps_expires ON password_reset_otps(expires_at);
CREATE INDEX idx_password_reset_otps_unverified ON password_reset_otps(email, verified, expires_at) WHERE verified = false;

-- Clean up expired OTPs periodically (optional - can be done via cron)
-- This function can be called by a scheduled job
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM password_reset_otps
  WHERE expires_at < NOW() OR verified = true;
END;
$$;

-- Add comments
COMMENT ON TABLE password_reset_otps IS 'Stores OTP codes for password reset (expires after 15 minutes)';
COMMENT ON COLUMN password_reset_otps.otp_code IS '6-digit OTP code';
COMMENT ON COLUMN password_reset_otps.expires_at IS 'OTP expiration timestamp (typically 15 minutes from creation)';
COMMENT ON COLUMN password_reset_otps.verified IS 'Whether the OTP has been verified and used';
COMMENT ON COLUMN password_reset_otps.verified_at IS 'Timestamp when OTP was verified';
