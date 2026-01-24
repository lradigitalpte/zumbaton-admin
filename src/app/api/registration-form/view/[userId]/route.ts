/**
 * API Route: Get Registration Form Details for Admin
 * GET /api/registration-form/view/:userId
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Check authentication
    const user = await getAuthenticatedUser(request)
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { userId } = await context.params
    const supabase = getSupabaseAdminClient()

    // Fetch the latest registration form for this user
    const { data: form, error } = await supabase
      .from(TABLES.REGISTRATION_FORMS)
      .select(`
        *,
        user:user_profiles!user_id (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !form) {
      return NextResponse.json(
        { success: false, error: 'No registration form found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: form,
    })
  } catch (error) {
    console.error('[View Registration Form] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
