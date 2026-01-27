/**
 * API Route: Staff Sign Registration Form
 * POST /api/registration-form/sign/:formId
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ formId: string }> }
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

    const { formId } = await context.params
    const body = await request.json()
    const { staffName } = body

    if (!staffName || staffName.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Staff name must be at least 3 characters' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()

    // Update the form with staff signature
    const { data, error } = await supabase
      .from(TABLES.REGISTRATION_FORMS)
      .update({
        staff_name: staffName.trim(),
        staff_signature: staffName.trim(),
        staff_signature_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', formId)
      .select()
      .single()

    if (error) {
      console.error('[Sign Form] Database error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save signature' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Signature saved successfully',
      data,
    })
  } catch (error) {
    console.error('[Sign Form] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
