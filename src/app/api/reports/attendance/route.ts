/**
 * Attendance / Booking Reports API
 * GET /api/reports/attendance?year=2026&month=4&scope=month
 *
 * Counts real class bookings only (confirmed, attended, no-show).
 * Guest/trial website bookings use is_trial_booking; member app/token bookings do not.
 * System placeholder classes (ZumFamilia custom schedule, etc.) are excluded from
 * "classes scheduled" and their bookings are counted by booked_at in the period.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import {
  BOOKING_COUNT_STATUSES,
  fetchInBatches,
  getMonthBoundsSgt,
  getSgtYmd,
  getYearBoundsSgt,
  isPlaceholderClassTitle,
  SGT_TIMEZONE,
} from '@/lib/reports-utils'

type ClassRow = {
  id: string
  scheduled_at: string
  title: string
  instructor_name: string | null
  capacity: number | null
}

type BookingRow = {
  id: string
  class_id: string
  is_trial_booking?: boolean
  status: string
  booked_at: string
}

function countBookings(bookings: BookingRow[]) {
  const trialBookings = bookings.filter(b => b.is_trial_booking).length
  const memberBookings = bookings.length - trialBookings
  return {
    totalBookings: bookings.length,
    trialBookings,
    memberBookings,
  }
}

function buildPeriodTotals(bookings: BookingRow[], totalClasses: number) {
  const counts = countBookings(bookings)
  const classesWithBookings = new Set(bookings.map(b => b.class_id)).size
  return {
    totalClasses,
    classesWithBookings,
    totalBookings: counts.totalBookings,
    memberBookings: counts.memberBookings,
    trialBookings: counts.trialBookings,
  }
}

type PeriodTotals = ReturnType<typeof buildPeriodTotals>

function sumYearSummary(
  yearSummary: Array<PeriodTotals & { month: number; monthName: string; year: number }>
): PeriodTotals {
  return yearSummary.reduce(
    (acc, row) => ({
      totalClasses: acc.totalClasses + row.totalClasses,
      classesWithBookings: acc.classesWithBookings + row.classesWithBookings,
      totalBookings: acc.totalBookings + row.totalBookings,
      memberBookings: acc.memberBookings + row.memberBookings,
      trialBookings: acc.trialBookings + row.trialBookings,
    }),
    {
      totalClasses: 0,
      classesWithBookings: 0,
      totalBookings: 0,
      memberBookings: 0,
      trialBookings: 0,
    }
  )
}

function isInRange(iso: string, rangeStart: Date, rangeEnd: Date) {
  const t = new Date(iso).getTime()
  return t >= rangeStart.getTime() && t < rangeEnd.getTime()
}

async function getPlaceholderClassIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<string[]> {
  const { data } = await supabase.from(TABLES.CLASSES).select('id, title')
  return (data || [])
    .filter((row: { id: string; title: string }) => isPlaceholderClassTitle(row.title))
    .map((row: { id: string }) => row.id)
}

async function getClassesInRange(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStart: Date,
  rangeEnd: Date,
  placeholderIds: Set<string>
): Promise<ClassRow[]> {
  const { data } = await supabase
    .from(TABLES.CLASSES)
    .select('id, scheduled_at, title, instructor_name, capacity')
    .gte('scheduled_at', rangeStart.toISOString())
    .lt('scheduled_at', rangeEnd.toISOString())
    .order('scheduled_at', { ascending: true })

  return (data || []).filter((cls: ClassRow) => !placeholderIds.has(cls.id))
}

async function getBookingsForClasses(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  classIds: string[]
): Promise<BookingRow[]> {
  if (classIds.length === 0) return []

  return fetchInBatches(classIds, async (batch) => {
    const { data, error } = await supabase
      .from(TABLES.BOOKINGS)
      .select('id, class_id, is_trial_booking, status, booked_at')
      .in('class_id', batch)
      .in('status', [...BOOKING_COUNT_STATUSES])

    if (error) {
      console.error('[Attendance Reports API] Booking batch error:', error.message)
      return []
    }
    return (data || []) as BookingRow[]
  })
}

async function getPlaceholderBookingsInRange(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  placeholderIds: string[],
  rangeStart: Date,
  rangeEnd: Date
): Promise<BookingRow[]> {
  if (placeholderIds.length === 0) return []

  return fetchInBatches(placeholderIds, async (batch) => {
    const { data, error } = await supabase
      .from(TABLES.BOOKINGS)
      .select('id, class_id, is_trial_booking, status, booked_at')
      .in('class_id', batch)
      .in('status', [...BOOKING_COUNT_STATUSES])
      .gte('booked_at', rangeStart.toISOString())
      .lt('booked_at', rangeEnd.toISOString())

    if (error) {
      console.error('[Attendance Reports API] Placeholder booking error:', error.message)
      return []
    }
    return (data || []) as BookingRow[]
  })
}

async function fetchYearAttendanceData(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  year: number,
  placeholderIds: string[],
  placeholderIdSet: Set<string>
) {
  const { rangeStart, rangeEnd } = getYearBoundsSgt(year)

  const classes = await getClassesInRange(supabase, rangeStart, rangeEnd, placeholderIdSet)
  const [classBookings, placeholderBookings] = await Promise.all([
    getBookingsForClasses(supabase, classes.map(c => c.id)),
    getPlaceholderBookingsInRange(supabase, placeholderIds, rangeStart, rangeEnd),
  ])

  return { classes, classBookings, placeholderBookings }
}

function buildYearSummary(
  year: number,
  allClasses: ClassRow[],
  allClassBookings: BookingRow[],
  allPlaceholderBookings: BookingRow[]
) {
  const summary = []

  for (let month = 1; month <= 12; month++) {
    const { rangeStart, rangeEnd } = getMonthBoundsSgt(year, month)
    const monthClasses = allClasses.filter(c => isInRange(c.scheduled_at, rangeStart, rangeEnd))
    const monthClassIds = new Set(monthClasses.map(c => c.id))
    const classBookings = allClassBookings.filter(b => monthClassIds.has(b.class_id))
    const placeholderBookings = allPlaceholderBookings.filter(b =>
      isInRange(b.booked_at, rangeStart, rangeEnd)
    )
    const monthName = new Intl.DateTimeFormat('en-US', { timeZone: SGT_TIMEZONE, month: 'long' }).format(rangeStart)

    summary.push({
      month,
      monthName,
      year,
      ...buildPeriodTotals([...classBookings, ...placeholderBookings], monthClasses.length),
    })
  }

  return summary
}

function formatSgtDate(iso: string) {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: SGT_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function formatSgtTime(iso: string) {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: SGT_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

function buildClassSessions(
  classes: ClassRow[],
  bookings: BookingRow[],
  placeholderBookings: BookingRow[]
) {
  const bookingsByClass: Record<string, BookingRow[]> = {}
  for (const booking of bookings) {
    if (!bookingsByClass[booking.class_id]) bookingsByClass[booking.class_id] = []
    bookingsByClass[booking.class_id].push(booking)
  }

  const sessions = classes.map(cls => {
    const classBookings = bookingsByClass[cls.id] || []
    const counts = countBookings(classBookings)

    return {
      id: cls.id,
      title: cls.title,
      instructor: cls.instructor_name || 'Unknown',
      scheduledAt: cls.scheduled_at,
      dateLabel: formatSgtDate(cls.scheduled_at),
      timeLabel: formatSgtTime(cls.scheduled_at),
      capacity: cls.capacity || 20,
      totalBookings: counts.totalBookings,
      memberBookings: counts.memberBookings,
      trialBookings: counts.trialBookings,
      hasBookings: counts.totalBookings > 0,
    }
  })

  if (placeholderBookings.length > 0) {
    const counts = countBookings(placeholderBookings)
    const earliestBooked = placeholderBookings.map(b => b.booked_at).sort()[0]

    sessions.push({
      id: 'guest-placeholder-bookings',
      title: 'Guest bookings (ZumFamilia / custom schedule)',
      instructor: '—',
      scheduledAt: earliestBooked,
      dateLabel: 'By booking date',
      timeLabel: '—',
      capacity: 0,
      totalBookings: counts.totalBookings,
      memberBookings: counts.memberBookings,
      trialBookings: counts.trialBookings,
      hasBookings: true,
    })
  }

  return sessions
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(request.url)

    const now = new Date()
    const { year: currentYear, month: currentMonth } = getSgtYmd(now)

    const scope = searchParams.get('scope') === 'year' ? 'year' : 'month'
    const year = parseInt(searchParams.get('year') || String(currentYear), 10)
    const month = parseInt(searchParams.get('month') || String(currentMonth), 10)

    if (!Number.isFinite(year)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid year' } },
        { status: 400 }
      )
    }

    const placeholderIds = await getPlaceholderClassIds(supabase)
    const placeholderIdSet = new Set(placeholderIds)

    const { classes: yearClasses, classBookings: yearClassBookings, placeholderBookings: yearPlaceholderBookings } =
      await fetchYearAttendanceData(supabase, year, placeholderIds, placeholderIdSet)

    const yearSummary = buildYearSummary(year, yearClasses, yearClassBookings, yearPlaceholderBookings)
    const yearTotals = sumYearSummary(yearSummary)

    if (scope === 'year') {
      const allBookings = [...yearClassBookings, ...yearPlaceholderBookings]
      return NextResponse.json({
        success: true,
        data: {
          scope: 'year',
          year,
          month: null,
          periodLabel: `${year}`,
          totals: buildPeriodTotals(allBookings, yearClasses.length),
          classSessions: [],
          yearSummary,
          yearTotals,
        },
      })
    }

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid month' } },
        { status: 400 }
      )
    }

    const { rangeStart, rangeEnd, monthName } = getMonthBoundsSgt(year, month)
    const periodLabel = `${monthName} ${year}`

    const classes = yearClasses.filter(c => isInRange(c.scheduled_at, rangeStart, rangeEnd))
    const monthClassIds = new Set(classes.map(c => c.id))
    const classBookings = yearClassBookings.filter(b => monthClassIds.has(b.class_id))
    const placeholderBookings = yearPlaceholderBookings.filter(b =>
      isInRange(b.booked_at, rangeStart, rangeEnd)
    )
    const allBookings = [...classBookings, ...placeholderBookings]

    const classSessions = buildClassSessions(classes, classBookings, placeholderBookings).sort((a, b) => {
      if (b.totalBookings !== a.totalBookings) return b.totalBookings - a.totalBookings
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    })

    return NextResponse.json({
      success: true,
      data: {
        scope: 'month',
        year,
        month,
        periodLabel,
        totals: buildPeriodTotals(allBookings, classes.length),
        classSessions,
        yearSummary,
        yearTotals,
      },
    })
  } catch (error) {
    console.error('[Attendance Reports API] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch attendance reports' } },
      { status: 500 }
    )
  }
}
