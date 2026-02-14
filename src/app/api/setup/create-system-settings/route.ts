/**
 * Setup Migration API Route
 * POST /api/setup/create-system-settings - Create the system_settings table
 * This is a one-time setup route
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get admin key from environment
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Service role key not configured',
      }, { status: 500 })
    }

    const adminClient = getSupabaseAdminClient()

    // Create table
    const { error: tableError } = await adminClient.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.system_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT UNIQUE NOT NULL,
          value JSONB NOT NULL DEFAULT '{}',
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(key);

        ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

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
      `,
    })

    if (tableError) {
      console.warn('Note: exec_sql may not be available, attempting direct creation...')
    }

    // Insert default promotions settings
    const { error: promoError } = await adminClient
      .from('system_settings')
      .upsert({
        key: 'promotions',
        value: {
          early_bird_enabled: true,
          early_bird_limit: 40,
          early_bird_discount_percent: 10,
          early_bird_validity_months: 2,
          referral_enabled: true,
          referral_discount_percent: 8,
        },
        description: 'Promotions configuration for early bird and referral programs',
      }, {
        onConflict: 'key',
      })

    if (promoError) {
      console.error('Error inserting promotions settings:', promoError)
      return NextResponse.json({
        success: false,
        error: 'Failed to insert promotions settings',
        details: promoError.message,
      }, { status: 500 })
    }

    // Insert default general settings
    const { error: generalError } = await adminClient
      .from('system_settings')
      .upsert({
        key: 'general',
        value: {
          maintenanceMode: false,
          enableNotifications: true,
          enableEmailNotifications: true,
        },
        description: 'General system settings',
      }, {
        onConflict: 'key',
      })

    if (generalError) {
      console.warn('Warning: Failed to insert general settings:', generalError)
    }

    return NextResponse.json({
      success: true,
      message: 'System settings table created and initialized successfully',
      data: {
        promotionsInitialized: true,
        generalInitialized: !generalError,
      },
    })
  } catch (error) {
    console.error('Error setting up system_settings:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to set up system settings',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
