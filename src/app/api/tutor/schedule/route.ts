import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

const SGT = 'Asia/Singapore'

function sgtYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SGT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Monday of the week containing ymd. */
function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDays(ymd, -((dow + 6) % 7))
}

/**
 * GET /api/tutor/schedule?view=week|month&date=YYYY-MM-DD
 * Instructor's schedule in Singapore time. Weeks run Monday–Sunday; days are keyed
 * by Singapore date and times are formatted in Singapore time (the server runs in UTC).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    }

    if (!['instructor', 'super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Instructor access required' } },
        { status: 403 }
      )
    }

    const supabase = getSupabaseAdminClient()
    const instructorId = user.id

    const { data: instructorProfile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', instructorId)
      .single()

    // An empty name must not match every class; strip chars that break or().
    const instructorName = (instructorProfile?.name || '').replace(/[,()%*\\]/g, ' ').trim()
    const classFilter = instructorName
      ? `instructor_id.eq.${instructorId},instructor_name.ilike.%${instructorName}%`
      : `instructor_id.eq.${instructorId}`

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') === 'month' ? 'month' : 'week'
    const dateParam = searchParams.get('date')
    const refYmd = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : sgtYmd(new Date())

    let startYmd: string
    let endYmd: string // inclusive
    if (view === 'month') {
      startYmd = `${refYmd.slice(0, 7)}-01`
      const [y, m] = refYmd.split('-').map(Number)
      endYmd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    } else {
      startYmd = mondayOf(refYmd)
      endYmd = addDays(startYmd, 6)
    }

    const startIso = new Date(`${startYmd}T00:00:00+08:00`).toISOString()
    const endIso = new Date(`${addDays(endYmd, 1)}T00:00:00+08:00`).toISOString()

    const { data: classes, error } = await supabase
      .from('classes')
      .select(`
        id,
        title,
        class_type,
        scheduled_at,
        duration_minutes,
        capacity,
        location,
        room_id,
        rooms (
          id,
          name
        ),
        status
      `)
      .or(classFilter)
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true })

    if (error) {
      console.error('[Tutor API] Error fetching schedule:', error)
      return NextResponse.json({ success: false, error: { message: 'Failed to fetch schedule' } }, { status: 500 })
    }

    const classIds = (classes || []).map(c => c.id)
    const bookingCounts: Record<string, number> = {}
    for (let i = 0; i < classIds.length; i += 150) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('class_id')
        .in('class_id', classIds.slice(i, i + 150))
        .in('status', ['confirmed', 'attended'])
      for (const b of bookings || []) bookingCounts[b.class_id] = (bookingCounts[b.class_id] || 0) + 1
    }

    const schedule: Record<string, Array<{
      id: string
      title: string
      classType: string
      time: string
      scheduledAt: string
      duration: number
      location: string | null
      status: string
      booked: number
      capacity: number
    }>> = {}

    for (const cls of classes || []) {
      const date = new Date(cls.scheduled_at)
      const dayKey = sgtYmd(date)
      if (!schedule[dayKey]) schedule[dayKey] = []

      let roomName: string | null = null
      if (cls.rooms) {
        if (Array.isArray(cls.rooms) && cls.rooms.length > 0) roomName = (cls.rooms[0] as any).name
        else if (typeof cls.rooms === 'object' && !Array.isArray(cls.rooms) && (cls.rooms as any).name) roomName = (cls.rooms as any).name
      }
      if (!roomName && cls.location) roomName = cls.location

      schedule[dayKey].push({
        id: cls.id,
        title: cls.title,
        classType: cls.class_type,
        time: date.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', timeZone: SGT }),
        scheduledAt: cls.scheduled_at,
        duration: cls.duration_minutes,
        location: roomName,
        status: cls.status,
        booked: bookingCounts[cls.id] || 0,
        capacity: cls.capacity,
      })
    }

    // Totals exclude cancelled classes.
    const active = (classes || []).filter(c => c.status !== 'cancelled')
    const totalByType: Record<string, number> = {}
    for (const cls of active) totalByType[cls.class_type] = (totalByType[cls.class_type] || 0) + 1

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        period: { start: startYmd, end: endYmd, view },
        summary: { totalClasses: active.length, byType: totalByType },
      },
    })
  } catch (error) {
    console.error('[Tutor API] Schedule error:', error)
    return NextResponse.json({ success: false, error: { message: 'Internal server error' } }, { status: 500 })
  }
}
