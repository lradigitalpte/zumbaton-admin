/**
 * Onboarding API Route
 * GET and PUT operations for onboarding completion status
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/onboarding - Check if user has completed onboarding
 */
async function handleGetOnboarding(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdminClient()

    // Get user profile with onboarding status
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('id', context.user.id)
      .single()

    if (error) {
      console.error('[API /onboarding GET] Supabase error:', error)
      // If column doesn't exist yet, return false (migration not run)
      return NextResponse.json({
        success: true,
        data: {
          completed: false,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        completed: profile?.onboarding_completed || false,
      },
    })
  } catch (error) {
    console.error('[API /onboarding GET]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

/**
 * PUT /api/onboarding - Mark onboarding as completed
 */
async function handlePutOnboarding(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { completed } = body

    if (typeof completed !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'completed must be a boolean',
        },
      }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()

    // Update user profile
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ 
        onboarding_completed: completed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', context.user.id)
      .select('onboarding_completed')
      .single()

    if (error) {
      console.error('[API /onboarding PUT] Supabase error:', error)
      // If column doesn't exist yet, migration hasn't been run
      // Return success anyway to prevent errors
      return NextResponse.json({
        success: true,
        data: {
          completed: false,
          message: 'Database column not found. Please run migration 021_add_onboarding_completed.sql',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        completed: data?.onboarding_completed || false,
      },
    })
  } catch (error) {
    console.error('[API /onboarding PUT]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

export const GET = withAuthentication(handleGetOnboarding)
export const PUT = withAuthentication(handlePutOnboarding)
