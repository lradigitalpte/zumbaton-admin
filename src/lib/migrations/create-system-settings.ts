/**
 * Migration: Create system_settings table for promotions and other configuration
 * This table stores global system configuration like promotion settings
 */

export async function createSystemSettingsTable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    return { success: false, error: 'Missing Supabase credentials' }
  }

  const sql = `
    -- Create system_settings table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.system_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      value JSONB NOT NULL DEFAULT '{}',
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create index on key for faster lookups
    CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(key);

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

    -- Insert default promotions settings if not exists
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

    -- Insert default general settings if not exists
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
  `

  try {
    // Execute SQL directly using fetch
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    })

    if (response.ok) {
      return { success: true, message: 'System settings table created successfully' }
    } else {
      const error = await response.json()
      console.error('Error creating system_settings table:', error)
      return { success: false, error }
    }
  } catch (error) {
    console.error('Error executing migration:', error)
    return { success: false, error }
  }
}

export default createSystemSettingsTable
