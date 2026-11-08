import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

/**
 * GET /api/tutor/students
 * All unique students who have booked the instructor's classes.
 *
 * Classes are matched the same way as /api/tutor/dashboard and /api/tutor/classes:
 * instructor_id = me OR instructor_name contains my name (classes with a free-text
 * or multi-instructor name have no instructor_id, which is why this list used to be empty).
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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '200'))
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: instructorProfile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', instructorId)
      .single()

    // Strip characters that would break the PostgREST or() filter; never match on an empty name.
    const instructorName = (instructorProfile?.name || '').replace(/[,()%*\\]/g, ' ').trim()
    const classFilter = instructorName
      ? `instructor_id.eq.${instructorId},instructor_name.ilike.%${instructorName}%`
      : `instructor_id.eq.${instructorId}`

    const { data: classes } = await supabase
      .from('classes')
      .select('id, scheduled_at, title')
      .or(classFilter)

    const classById = new Map((classes || []).map((c) => [c.id as string, c]))
    const classIds = [...classById.keys()]

    const empty = NextResponse.json({
      success: true,
      data: { students: [], meta: { total: 0, limit, offset, hasMore: false } },
    })
    if (classIds.length === 0) return empty

    // Bookings for the instructor's classes (chunked to keep the URL short).
    const bookings: { user_id: string | null; status: string; class_id: string }[] = []
    for (let i = 0; i < classIds.length; i += 150) {
      const { data } = await supabase
        .from('bookings')
        .select('user_id, status, class_id')
        .in('class_id', classIds.slice(i, i + 150))
      bookings.push(...(data || []))
    }

    const now = Date.now()
    const userStats: Record<
      string,
      {
        classesBooked: number
        classesAttended: number
        noShows: number
        upcoming: number
        lastAttendedAt: string | null
        nextBookedAt: string | null
        nextClassTitle: string | null
      }
    > = {}

    for (const booking of bookings) {
      if (!booking.user_id) continue
      const s = (userStats[booking.user_id] ??= {
        classesBooked: 0,
        classesAttended: 0,
        noShows: 0,
        upcoming: 0,
        lastAttendedAt: null,
        nextBookedAt: null,
        nextClassTitle: null,
      })
      const cls = classById.get(booking.class_id)
      const at = (cls?.scheduled_at as string | undefined) ?? null
      const isFuture = at ? new Date(at).getTime() > now : false

      if (['confirmed', 'attended'].includes(booking.status)) s.classesBooked++
      if (booking.status === 'attended') {
        s.classesAttended++
        if (at && (!s.lastAttendedAt || at > s.lastAttendedAt)) s.lastAttendedAt = at
      }
      if (booking.status === 'no-show') s.noShows++
      if (booking.status === 'confirmed' && isFuture && at) {
        s.upcoming++
        if (!s.nextBookedAt || at < s.nextBookedAt) {
          s.nextBookedAt = at
          s.nextClassTitle = (cls?.title as string) ?? null
        }
      }
    }

    const userIds = Object.keys(userStats)
    if (userIds.length === 0) return empty

    // Profiles (chunked), then search/sort/paginate in memory.
    const profiles: { id: string; name: string; email: string; avatar_url: string | null; phone: string | null; created_at: string }[] = []
    for (let i = 0; i < userIds.length; i += 150) {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, name, email, avatar_url, phone, created_at')
        .in('id', userIds.slice(i, i + 150))
      profiles.push(...(data || []))
    }

    const term = search.toLowerCase()
    const matched = profiles
      .filter((p) => !term || (p.name || '').toLowerCase().includes(term) || (p.email || '').toLowerCase().includes(term))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    const students = matched.slice(offset, offset + limit).map((profile) => {
      const s = userStats[profile.id]
      // Rate over classes that have finished (attended + no-show), so future bookings don't drag it down.
      const finished = s.classesAttended + s.noShows
      return {
        ...profile,
        stats: s,
        attendanceRate: finished > 0 ? Math.round((s.classesAttended / finished) * 100) : 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        students,
        meta: {
          total: matched.length,
          limit,
          offset,
          hasMore: offset + students.length < matched.length,
        },
      },
    })
  } catch (error) {
    console.error('[Tutor API] Students error:', error)
    return NextResponse.json({ success: false, error: { message: 'Internal server error' } }, { status: 500 })
  }
}
