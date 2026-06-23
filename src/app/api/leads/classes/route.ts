/**
 * Upcoming classes for the Leads "Book into class" modal.
 * GET /api/leads/classes - scheduled, upcoming classes with current booked count.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    if (!['super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
    }

    const supabase = getSupabaseAdminClient()
    const nowIso = new Date().toISOString()

    const { data: classes, error } = await supabase
      .from('classes')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(200)

    if (error) {
      console.error('[API /leads/classes] Supabase error:', error)
      return NextResponse.json({ success: false, error: { message: 'Failed to fetch classes' } }, { status: 500 })
    }

    const ids = (classes || []).map((c) => c.id)
    const bookedCount: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('class_id')
        .in('class_id', ids)
        .in('status', ['confirmed', 'attended'])
      for (const b of bookings || []) {
        bookedCount[b.class_id] = (bookedCount[b.class_id] || 0) + 1
      }
    }

    const data = (classes || []).map((c: Record<string, any>) => ({
      id: c.id,
      title: c.title,
      scheduledAt: c.scheduled_at,
      durationMinutes: c.duration_minutes,
      capacity: c.capacity,
      isOutdoor: c.is_outdoor === true,
      location: c.location || c.room_name || '',
      bookedCount: bookedCount[c.id] || 0,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[API /leads/classes]', error)
    return NextResponse.json({ success: false, error: { message: 'Server error' } }, { status: 500 })
  }
}
