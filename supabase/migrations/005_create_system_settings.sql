-- Migration: Create system_settings table for storing application-wide settings
-- This table stores business info, booking rules, token settings, and appearance settings

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_type VARCHAR(50) NOT NULL UNIQUE CHECK (setting_type IN ('business', 'booking', 'tokens', 'appearance')),
  settings_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_type ON system_settings(setting_type);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view settings"
  ON system_settings FOR SELECT
  USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can insert settings"
  ON system_settings FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update settings"
  ON system_settings FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- Insert default settings if they don't exist
INSERT INTO system_settings (setting_type, settings_data) VALUES
  ('business', '{
    "businessName": "Zumbathon Fitness Studio",
    "email": "hello@zumbathon.com",
    "phone": "+1 (555) 123-4567",
    "address": "123 Fitness Street",
    "city": "Los Angeles, CA 90001",
    "country": "United States",
    "timezone": "America/Los_Angeles",
    "currency": "USD",
    "language": "en"
  }'::jsonb),
  ('booking', '{
    "maxBookingsPerUser": 5,
    "cancellationWindow": 24,
    "noShowPenalty": true,
    "noShowPenaltyTokens": 1,
    "waitlistEnabled": true,
    "autoConfirmBookings": true,
    "reminderHoursBefore": 2
  }'::jsonb),
  ('tokens', '{
    "tokenExpiryDays": 90,
    "allowTokenTransfer": false,
    "minPurchaseTokens": 1,
    "maxPurchaseTokens": 100
  }'::jsonb),
  ('appearance', '{
    "primaryColor": "#6366f1",
    "accentColor": "#10b981",
    "logoUrl": "",
    "darkModeDefault": false
  }'::jsonb)
ON CONFLICT (setting_type) DO NOTHING;

