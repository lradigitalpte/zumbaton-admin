-- Create system_settings table for storing global configuration
-- Run this in Supabase SQL editor

-- Drop existing table if it exists (to ensure clean state)
DROP TABLE IF EXISTS public.system_settings CASCADE;

-- Create the table fresh with both old and new schema structures
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT,
  value JSONB,
  setting_type TEXT,
  settings_data JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key),
  UNIQUE(setting_type)
);

-- Create indexes for faster lookups
CREATE INDEX idx_system_settings_key ON public.system_settings(key);
CREATE INDEX idx_system_settings_type ON public.system_settings(setting_type);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to read, only admins to modify
DROP POLICY IF EXISTS system_settings_read ON public.system_settings;
CREATE POLICY system_settings_read ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS system_settings_write ON public.system_settings;
CREATE POLICY system_settings_write ON public.system_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS system_settings_insert ON public.system_settings;
CREATE POLICY system_settings_insert ON public.system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- Insert default business settings (old schema)
INSERT INTO public.system_settings (setting_type, settings_data, description)
VALUES (
  'business',
  '{
    "businessName": "Zumbaton",
    "businessEmail": "admin@zumbaton.com",
    "businessPhone": "",
    "businessAddress": "",
    "businessCity": "",
    "businessCountry": "",
    "timezone": "UTC"
  }'::jsonb,
  'Business information and settings'
)
ON CONFLICT (setting_type) DO NOTHING;

-- Insert default booking settings (old schema)
INSERT INTO public.system_settings (setting_type, settings_data, description)
VALUES (
  'booking',
  '{
    "minBookingHours": 1,
    "maxBookingMonths": 3,
    "cancellationDeadlineHours": 24,
    "autoConfirmBookings": true
  }'::jsonb,
  'Booking rules and constraints'
)
ON CONFLICT (setting_type) DO NOTHING;

-- Insert default tokens settings (old schema)
INSERT INTO public.system_settings (setting_type, settings_data, description)
VALUES (
  'tokens',
  '{
    "tokensPerClass": 1,
    "tokenExpiryMonths": 12
  }'::jsonb,
  'Token/package settings'
)
ON CONFLICT (setting_type) DO NOTHING;

-- Insert default appearance settings (old schema)
INSERT INTO public.system_settings (setting_type, settings_data, description)
VALUES (
  'appearance',
  '{
    "primaryColor": "#6B46C1",
    "accentColor": "#EC4899",
    "logoUrl": "",
    "faviconUrl": ""
  }'::jsonb,
  'UI appearance and branding'
)
ON CONFLICT (setting_type) DO NOTHING;

-- Insert default promotions settings (new schema)
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'promotions',
  '{
    "early_bird_enabled": true,
    "early_bird_limit": 40,
    "early_bird_discount_percent": 10,
    "early_bird_validity_months": 2,
    "referral_enabled": true,
    "referral_discount_percent": 8
  }'::jsonb,
  'Promotions configuration for early bird and referral programs'
)
ON CONFLICT (key) DO NOTHING;

-- Insert default general settings (new schema)
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'general',
  '{
    "maintenanceMode": false,
    "enableNotifications": true,
    "enableEmailNotifications": true
  }'::jsonb,
  'General system settings'
)
ON CONFLICT (key) DO NOTHING;
