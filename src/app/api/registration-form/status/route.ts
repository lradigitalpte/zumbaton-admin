import { NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'

/**
 * GET /api/registration-form/status?userId=xxx
 * Get registration form status for a user
 */
export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdminClient()
    
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get latest registration form for user
    const { data, error } = await supabase
      .from(TABLES.REGISTRATION_FORMS)
      .select('status, submitted_at, token')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[Registration Form Status] Database error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch registration form status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || null,
    })
  } catch (error) {
    console.error('[Registration Form Status] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
