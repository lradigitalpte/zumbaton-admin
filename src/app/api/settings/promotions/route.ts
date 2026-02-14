/**
 * Promotions Settings API Route
 * GET /api/settings/promotions - Get promo settings
 * PUT /api/settings/promotions - Update promo settings (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser, hasRequiredRole } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

export interface PromotionsSettings {
  early_bird_enabled: boolean
  early_bird_limit: number
  early_bird_discount_percent: number
  early_bird_validity_months: number
  referral_enabled: boolean
  referral_discount_percent: number
}

function getDefaultPromotionsSettings(): PromotionsSettings {
  return {
    early_bird_enabled: true,
    early_bird_limit: 40,
    early_bird_discount_percent: 10,
    early_bird_validity_months: 2,
    referral_enabled: true,
    referral_discount_percent: 8,
  }
}

/**
 * GET /api/settings/promotions - Get promotions settings
 */
async function handleGetPromotionsSettings(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const adminClient = getSupabaseAdminClient()

    // Try to get settings from system_settings table
    const { data, error } = await adminClient
      .from('system_settings')
      .select('value')
      .eq('key', 'promotions')
      .single()

    // If table doesn't exist or record not found, return defaults
    if (error && (error.code === '42P01' || error.code === 'PGRST116')) {
      // 42P01 = relation does not exist, PGRST116 = no rows found
      console.warn('system_settings table or promotions record not found, returning defaults')
      return NextResponse.json({
        success: true,
        data: getDefaultPromotionsSettings(),
        note: 'Using default settings. Please run migration to create persistent settings.',
      })
    }

    if (error) {
      console.error('Error fetching promotions settings:', error)
      return NextResponse.json({
        success: true,
        data: getDefaultPromotionsSettings(),
      })
    }

    return NextResponse.json({
      success: true,
      data: data?.value || getDefaultPromotionsSettings(),
    })
  } catch (error) {
    console.error('Error getting promotions settings:', error)
    return NextResponse.json({
      success: true,
      data: getDefaultPromotionsSettings(),
    })
  }
}

/**
 * PUT /api/settings/promotions - Update promotions settings (admin only)
 */
async function handleUpdatePromotionsSettings(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    // Check admin permission
    const isAdmin = hasRequiredRole(context.user.role, 'admin')
    const isSuperAdmin = hasRequiredRole(context.user.role, 'super_admin')

    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can update promotions settings',
        },
      }, { status: 403 })
    }

    const body = await request.json()
    const adminClient = getSupabaseAdminClient()

    // Validate input
    const settings: PromotionsSettings = {
      early_bird_enabled: typeof body.early_bird_enabled === 'boolean' ? body.early_bird_enabled : true,
      early_bird_limit: typeof body.early_bird_limit === 'number' ? body.early_bird_limit : 40,
      early_bird_discount_percent: typeof body.early_bird_discount_percent === 'number' ? body.early_bird_discount_percent : 10,
      early_bird_validity_months: typeof body.early_bird_validity_months === 'number' ? body.early_bird_validity_months : 2,
      referral_enabled: typeof body.referral_enabled === 'boolean' ? body.referral_enabled : true,
      referral_discount_percent: typeof body.referral_discount_percent === 'number' ? body.referral_discount_percent : 8,
    }

    // Validate ranges
    if (settings.early_bird_limit < 0) settings.early_bird_limit = 0
    if (settings.early_bird_discount_percent < 0 || settings.early_bird_discount_percent > 100) settings.early_bird_discount_percent = 10
    if (settings.early_bird_validity_months < 1) settings.early_bird_validity_months = 1
    if (settings.referral_discount_percent < 0 || settings.referral_discount_percent > 100) settings.referral_discount_percent = 8

    // Try to upsert settings - if table doesn't exist, create it first
    let { error } = await adminClient
      .from('system_settings')
      .upsert({
        key: 'promotions',
        value: settings,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      })

    // If table doesn't exist, return helpful error
    if (error && error.code === '42P01') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TABLE_NOT_FOUND',
          message: 'System settings table needs to be created. Please run the migration: supabase/migrations/030_create_system_settings.sql',
        },
      }, { status: 500 })
    }

    if (error) {
      console.error('Error updating promotions settings:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update promotions settings',
        },
      }, { status: 500 })
    }

    // Create audit log
    try {
      await adminClient
        .from('audit_logs')
        .insert({
          user_id: context.user.id,
          action: 'update_promotions_settings',
          resource_id: 'promotions',
          resource_type: 'settings',
          description: 'Updated promotions settings',
          changes: settings,
        })
    } catch (auditError) {
      console.warn('Failed to create audit log:', auditError)
    }

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Error updating promotions settings:', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update promotions settings',
      },
    }, { status: 500 })
  }
}

export const GET = withAuthentication(handleGetPromotionsSettings)
export const PUT = withAuthentication(handleUpdatePromotionsSettings)

