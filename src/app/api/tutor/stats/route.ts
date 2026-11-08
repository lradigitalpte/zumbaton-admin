import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

const SGT = 'Asia/Singapore'

/** "YYYY-MM" of an instant in Singapore time. */
function sgtMonth(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SGT, year: 'numeric', month: '2-digit' }).format(d)
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function rate(attended: number, noShows: number) {
  const finished = attended + noShows
  return finished > 0 ? Math.round((attended / finished) * 100) : 0
}

function pctChange(current: number, previous: number) {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100)
  return current > 0 ? 100 : 0
}

/**
 * GET /api/tutor/stats
 * Instructor statistics, in Singapore time.
 *
 * - Attendance rate = attended / (attended + no-show): only classes that have happened count,
 *   so future bookings don't look like missed classes.
 * - Guest/trial bookings (no member account) are counted separately and never appear as a student.
 * - Classes "taught" = past, not cancelled.
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
    const now = new Date()

    const { data: instructorProfile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', instructorId)
      .single()

    const instructorName = (instructorProfile?.name || '').replace(/[,()%*\\]/g, ' ').trim()
    const classFilter = instructorName
      ? `instructor_id.eq.${instructorId},instructor_name.ilike.%${instructorName}%`
      : `instructor_id.eq.${instructorId}`

    const { data: allClassesRaw } = await supabase
      .from('classes')
      .select('id, class_type, scheduled_at, capacity, status')
      .or(classFilter)

    const allClasses = (allClassesRaw || []).filter((c) => c.status !== 'cancelled')
    const classById = new Map(allClasses.map((c) => [c.id as string, c]))
    const classIds = [...classById.keys()]

    // One pass over all bookings for these classes (chunked to keep URLs short).
    const bookings: { user_id: string | null; status: string; class_id: string }[] = []
    for (let i = 0; i < classIds.length; i += 150) {
      const { data } = await supabase
        .from('bookings')
        .select('user_id, status, class_id')
        .in('class_id', classIds.slice(i, i + 150))
      bookings.push(...(data || []))
    }

    const thisMonth = sgtMonth(now)
    const lastMonth = shiftMonth(thisMonth, -1)
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth, i - 5))

    type Bucket = { classes: number; booked: number; attended: number; noShows: number; members: Set<string>; guests: number }
    const newBucket = (): Bucket => ({ classes: 0, booked: 0, attended: 0, noShows: 0, members: new Set(), guests: 0 })

    const overall = newBucket()
    const byMonth = new Map<string, Bucket>(months.map((m) => [m, newBucket()]))
    byMonth.set(lastMonth, byMonth.get(lastMonth) ?? newBucket())
    const byType = new Map<string, Bucket>()
    const perStudent = new Map<string, { booked: number; attended: number; noShows: number }>()

    let taught = 0
    let totalCapacity = 0
    for (const c of allClasses) {
      const month = sgtMonth(new Date(c.scheduled_at))
      const isPast = new Date(c.scheduled_at) < now
      if (isPast) taught++
      totalCapacity += c.capacity || 0
      overall.classes++
      const mb = byMonth.get(month)
      if (mb) mb.classes++
      const tb = byType.get(c.class_type) ?? newBucket()
      tb.classes++
      byType.set(c.class_type, tb)
    }

    for (const b of bookings) {
      const cls = classById.get(b.class_id)
      if (!cls) continue
      const month = sgtMonth(new Date(cls.scheduled_at))
      const buckets = [overall, byMonth.get(month), byType.get(cls.class_type)].filter(Boolean) as Bucket[]
      const counts = ['confirmed', 'attended'].includes(b.status)
      for (const bucket of buckets) {
        if (counts) bucket.booked++
        if (b.status === 'attended') bucket.attended++
        if (b.status === 'no-show') bucket.noShows++
        if (counts || b.status === 'no-show') {
          if (b.user_id) bucket.members.add(b.user_id)
          else bucket.guests++
        }
      }
      if (b.user_id && (counts || b.status === 'no-show')) {
        const s = perStudent.get(b.user_id) ?? { booked: 0, attended: 0, noShows: 0 }
        if (counts) s.booked++
        if (b.status === 'attended') s.attended++
        if (b.status === 'no-show') s.noShows++
        perStudent.set(b.user_id, s)
      }
    }

    // Top students by classes actually attended (members only).
    const ranked = [...perStudent.entries()]
      .sort((a, b) => b[1].attended - a[1].attended || b[1].booked - a[1].booked)
      .slice(0, 5)
    const names = new Map<string, string>()
    if (ranked.length) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name')
        .in('id', ranked.map(([id]) => id))
      for (const p of profiles || []) names.set(p.id, p.name || 'Member')
    }
    const topStudents = ranked.map(([id, s]) => ({
      id,
      name: names.get(id) || 'Member',
      classes: s.attended,
      booked: s.booked,
      noShows: s.noShows,
      attendance: rate(s.attended, s.noShows),
    }))

    const tm = byMonth.get(thisMonth)!
    const lm = byMonth.get(lastMonth)!
    const monthLabel = (ym: string) =>
      new Date(`${ym}-15T12:00:00+08:00`).toLocaleDateString('en-SG', { month: 'short', timeZone: SGT })

    const byClassType: Record<string, { classes: number; students: number; attendance: number; attendanceRate: number }> = {}
    for (const [type, b] of byType) {
      byClassType[type] = { classes: b.classes, students: b.members.size, attendance: b.attended, attendanceRate: rate(b.attended, b.noShows) }
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalClassesTaught: taught,
          totalScheduled: overall.classes,
          uniqueStudents: overall.members.size,
          totalStudentBookings: overall.booked,
          guestBookings: overall.guests,
          attendanceRate: rate(overall.attended, overall.noShows),
          noShowRate: overall.attended + overall.noShows > 0 ? Math.round((overall.noShows / (overall.attended + overall.noShows)) * 100) : 0,
          avgClassSize: overall.classes > 0 ? Math.round((overall.booked / overall.classes) * 10) / 10 : 0,
          capacityUtilization: totalCapacity > 0 ? Math.round((overall.booked / totalCapacity) * 100) : 0,
        },
        thisMonth: {
          classes: tm.classes,
          students: tm.members.size,
          attendance: tm.attended,
          attendanceRate: rate(tm.attended, tm.noShows),
        },
        lastMonth: {
          classes: lm.classes,
          students: lm.members.size,
          attendance: lm.attended,
          attendanceRate: rate(lm.attended, lm.noShows),
        },
        changes: {
          classesChange: pctChange(tm.classes, lm.classes),
          studentsChange: pctChange(tm.members.size, lm.members.size),
          // Percentage points, not percent.
          attendanceRateChange: rate(tm.attended, tm.noShows) - rate(lm.attended, lm.noShows),
        },
        byClassType,
        topStudents,
        monthlyPerformance: months.map((m) => {
          const b = byMonth.get(m)!
          return {
            month: monthLabel(m),
            classes: b.classes,
            students: b.members.size,
            booked: b.booked,
            attended: b.attended,
            attendance: rate(b.attended, b.noShows),
          }
        }),
      },
    })
  } catch (error) {
    console.error('[Tutor API] Stats error:', error)
    return NextResponse.json({ success: false, error: { message: 'Internal server error' } }, { status: 500 })
  }
}
