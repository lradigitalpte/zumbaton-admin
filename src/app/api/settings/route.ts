// System Settings API Route
// GET and PATCH operations for system-wide settings

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export const dynamic = 'force-dynamic'

// GET /api/settings - Get all system settings
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    if (!['super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Admin access required' } },
        { status: 403 }
      )
    }

    const supabase = getSupabaseAdminClient()

    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('setting_type, settings_data')
      .order('setting_type')

    if (error) {
      console.error('[API /settings] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to fetch settings',
        },
      }, { status: 500 })
    }

    // Transform to object format
    const settingsMap: Record<string, any> = {}
    settings?.forEach((s) => {
      settingsMap[s.setting_type] = s.settings_data
    })

    return NextResponse.json({
      success: true,
      data: {
        business: settingsMap.business || {},
        booking: settingsMap.booking || {},
        tokens: settingsMap.tokens || {},
        appearance: settingsMap.appearance || {},
      },
    })
  } catch (error) {
    console.error('[API /settings]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

// PATCH /api/settings - Update system settings
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    if (!['super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Admin access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { business, booking, tokens, appearance } = body

    const supabase = getSupabaseAdminClient()

    // Update each setting type if provided
    const updates: Promise<any>[] = []

    if (business) {
      updates.push(
        supabase
          .from('system_settings')
          .upsert({
            setting_type: 'business',
            settings_data: business,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'setting_type',
          })
      )
    }

    if (booking) {
      updates.push(
        supabase
          .from('system_settings')
          .upsert({
            setting_type: 'booking',
            settings_data: booking,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'setting_type',
          })
      )
    }

    if (tokens) {
      updates.push(
        supabase
          .from('system_settings')
          .upsert({
            setting_type: 'tokens',
            settings_data: tokens,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'setting_type',
          })
      )
    }

    if (appearance) {
      updates.push(
        supabase
          .from('system_settings')
          .upsert({
            setting_type: 'appearance',
            settings_data: appearance,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'setting_type',
          })
      )
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No settings provided to update',
        },
      }, { status: 400 })
    }

    const results = await Promise.all(updates)
    const errors = results.filter(r => r.error)

    if (errors.length > 0) {
      console.error('[API /settings PATCH] Supabase errors:', errors)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to update settings',
        },
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Settings updated successfully',
      },
    })
  } catch (error) {
    console.error('[API /settings PATCH]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

