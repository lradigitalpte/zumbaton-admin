// Simple No-Show Check Endpoint
// Shows raw booking data to diagnose issues

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'

async function handleGet(request: NextRequest) {
  const adminClient = getSupabaseAdminClient()
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({
      error: 'userId required',
    }, { status: 400 })
  }

  // Get raw bookings with class info
  const { data: bookings } = await adminClient
    .from('bookings')
    .select(`
      id,
      status,
      tokens_used,
      created_at,
      user_id,
      class:classes!class_id(
        id,
        title,
        scheduled_at,
        duration_minutes
      )
    `)
    .eq('user_id', userId)

  // Get token transactions
  const { data: transactions } = await adminClient
    .from('token_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  // Get user profile
  const { data: userProfile } = await adminClient
    .from('user_profiles')
    .select('id, name, email, total_no_shows, is_flagged, currentTokenBalance')
    .eq('id', userId)
    .single()

  const now = new Date()

  // Analyze each booking
  const analysis = (bookings || []).map((booking: any) => {
    const classData = booking.class
    const classStart = new Date(classData.scheduled_at)
    const classEnd = new Date(classStart.getTime() + classData.duration_minutes * 60000)
    const graceEnd = new Date(classEnd.getTime() + 30 * 60000)

    return {
      bookingId: booking.id,
      status: booking.status,
      tokensUsed: booking.tokens_used,
      className: classData.title,
      classStart: classStart.toISOString(),
      classEnd: classEnd.toISOString(),
      graceEnd: graceEnd.toISOString(),
      now: now.toISOString(),
      classEnded: now > classEnd ? '✅ YES' : '❌ NO',
      gracePeriodPassed: now > graceEnd ? '✅ YES' : '❌ NO',
      shouldBeNoShow: booking.status === 'confirmed' && now > graceEnd ? '⚠️ YES' : 'NO',
    }
  })

  return NextResponse.json({
    userProfile,
    totalBookings: bookings?.length || 0,
    bookingStatuses: {
      confirmed: (bookings || []).filter((b: any) => b.status === 'confirmed').length,
      attended: (bookings || []).filter((b: any) => b.status === 'attended').length,
      noShow: (bookings || []).filter((b: any) => b.status === 'no-show').length,
      cancelled: (bookings || []).filter((b: any) => b.status === 'cancelled').length,
    },
    bookingAnalysis: analysis,
    recentTransactions: (transactions || []).slice(0, 10).map((t: any) => ({
      id: t.id,
      type: t.transaction_type,
      tokensChange: t.tokens_change,
      description: t.description,
      createdAt: t.created_at,
    })),
  })
}

export const GET = handleGet
