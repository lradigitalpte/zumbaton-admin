/**
 * Reports Overview API
 * GET /api/reports - Get dashboard overview stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import {
  BOOKING_COUNT_STATUSES,
  fetchInBatches,
  getMonthBoundsSgt,
  getSgtMonthNumber,
  getSgtYmd,
  getYearBoundsSgt,
  initMonthBuckets,
  SGT_TIMEZONE,
} from '@/lib/reports-utils'

type PaymentRow = {
  amount_cents?: number | null
  package_id?: string | null
  is_trial_booking?: boolean | null
  user_id?: string | null
  created_at?: string
  packages?: { token_count?: number } | { token_count?: number }[] | null
}

function getPackageTokenCount(packages: PaymentRow['packages']) {
  const pkg = Array.isArray(packages) ? packages[0] : packages
  return pkg?.token_count || 0
}

function splitPaymentRevenue(payments: PaymentRow[]) {
  let packageRevenue = 0
  let trialRevenue = 0
  let tokensSold = 0

  for (const payment of payments) {
    const amount = (payment.amount_cents || 0) / 100
    if (payment.package_id) {
      packageRevenue += amount
      tokensSold += getPackageTokenCount(payment.packages)
    } else {
      trialRevenue += amount
    }
  }

  return {
    totalRevenue: packageRevenue + trialRevenue,
    packageRevenue,
    trialRevenue,
    paymentCount: payments.length,
    tokensSold,
  }
}

// GET /api/reports - Get overview statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(request.url)

    const now = new Date()
    const { year: currentYear, month: currentMonth } = getSgtYmd(now)
    const year = parseInt(searchParams.get('year') || String(currentYear), 10)
    const monthRaw = searchParams.get('month')
    const selectedMonth =
      monthRaw && monthRaw !== 'all' ? parseInt(monthRaw, 10) : null

    let rangeStart: Date
    let rangeEnd: Date
    let periodLabel: string

    if (selectedMonth && selectedMonth >= 1 && selectedMonth <= 12) {
      const bounds = getMonthBoundsSgt(year, selectedMonth)
      rangeStart = bounds.rangeStart
      rangeEnd = bounds.rangeEnd
      periodLabel = `${bounds.monthName} ${year}`
    } else {
      const bounds = getYearBoundsSgt(year)
      rangeStart = bounds.rangeStart
      rangeEnd = bounds.rangeEnd
      periodLabel = `${year}`
    }

    const periodLength = rangeEnd.getTime() - rangeStart.getTime()
    const prevRangeStart = new Date(rangeStart.getTime() - periodLength)
    const prevRangeEnd = rangeStart
    const rangeStartIso = rangeStart.toISOString()
    const rangeEndIso = rangeEnd.toISOString()
    const prevRangeStartIso = prevRangeStart.toISOString()
    const prevRangeEndIso = prevRangeEnd.toISOString()

    // Fetch all required data in parallel (deduplicated queries)
    const [
      usersResult,
      activeUsersResult,
      newUsersInRange,
      newUsersPreviousPeriod,
      paymentsResult,
      paymentsPreviousPeriod,
      classesThisMonth,
      bookingsResult,
      topInstructorsResult,
      periodBookingsResult,
      tokensSoldResult,
      prevPeriodBookings,
      monthlyDataResult,
      recentActivityResult,
    ] = await Promise.all([
      // Total users (only customers, exclude staff)
      supabase
        .from(TABLES.USER_PROFILES)
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user'),
      
      // Active users (users with bookings in range)
      supabase
        .from(TABLES.BOOKINGS)
        .select('user_id', { count: 'exact' })
        .gte('booked_at', rangeStartIso)
        .lt('booked_at', rangeEndIso)
        .in('status', [...BOOKING_COUNT_STATUSES])
        .not('user_id', 'is', null),
      
      // New users in range (only customers, exclude staff)
      supabase
        .from(TABLES.USER_PROFILES)
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .gte('created_at', rangeStartIso)
        .lt('created_at', rangeEndIso),
      
      // New users in previous period (for comparison)
      supabase
        .from(TABLES.USER_PROFILES)
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .gte('created_at', prevRangeStartIso)
        .lt('created_at', prevRangeEndIso),
      
      // Payments in range (revenue = succeeded HitPay payments by payment date)
      supabase
        .from(TABLES.PAYMENTS)
        .select('id, amount_cents, currency, created_at, package_id, is_trial_booking, user_id, packages(token_count)')
        .gte('created_at', rangeStartIso)
        .lt('created_at', rangeEndIso)
        .eq('status', 'succeeded'),
      
      // Payments in previous period (for comparison)
      supabase
        .from(TABLES.PAYMENTS)
        .select('id, amount_cents, package_id')
        .gte('created_at', prevRangeStartIso)
        .lt('created_at', prevRangeEndIso)
        .eq('status', 'succeeded'),
      
      // Classes in range (by scheduled date)
      supabase
        .from(TABLES.CLASSES)
        .select('id, scheduled_at', { count: 'exact' })
        .gte('scheduled_at', rangeStartIso)
        .lt('scheduled_at', rangeEndIso)
        .in('status', ['scheduled', 'in-progress', 'completed']),
      
      // Bookings for attendance stats
      supabase
        .from(TABLES.BOOKINGS)
        .select('id, status')
        .gte('booked_at', rangeStartIso)
        .lt('booked_at', rangeEndIso)
        .in('status', [...BOOKING_COUNT_STATUSES]),
      
      // Top instructors by class count
      supabase
        .from(TABLES.CLASSES)
        .select('id, instructor_id, instructor_name')
        .gte('scheduled_at', rangeStartIso)
        .lt('scheduled_at', rangeEndIso)
        .not('instructor_id', 'is', null),
      
      // Bookings for top classes + instructor students (single query)
      supabase
        .from(TABLES.BOOKINGS)
        .select('class_id, user_id, status')
        .gte('booked_at', rangeStartIso)
        .lt('booked_at', rangeEndIso)
        .in('status', [...BOOKING_COUNT_STATUSES])
        .not('class_id', 'is', null),
      
      // Token packages purchased in range (from user_packages, not token_transactions)
      supabase
        .from(TABLES.USER_PACKAGES)
        .select('tokens_remaining, packages(token_count)')
        .gte('purchased_at', rangeStartIso)
        .lt('purchased_at', rangeEndIso),
      
      // Previous period bookings for growth calculation
      supabase
        .from(TABLES.BOOKINGS)
        .select('class_id')
        .gte('booked_at', prevRangeStartIso)
        .lt('booked_at', prevRangeEndIso)
        .in('status', [...BOOKING_COUNT_STATUSES])
        .not('class_id', 'is', null),
      
      // Monthly data for chart (full selected year)
      getMonthlyData(supabase, year),

      // Recent activity in selected period
      getRecentActivity(supabase, rangeStartIso, rangeEndIso),
    ])

    // Calculate stats
    const totalUsers = usersResult.count || 0
    
    // Get unique active users
    const activeUserIds = new Set(
      (activeUsersResult.data || []).map(b => b.user_id)
    )
    const activeUsers = activeUserIds.size
    
    const newUsersInRangeCount = newUsersInRange.count || 0
    const newUsersPreviousPeriodCount = newUsersPreviousPeriod.count || 0
    // Calculate user growth - cap at reasonable values
    let userGrowth = 0
    if (newUsersPreviousPeriodCount > 0) {
      userGrowth = ((newUsersInRangeCount - newUsersPreviousPeriodCount) / newUsersPreviousPeriodCount * 100)
      // Cap growth at 1000% to avoid unrealistic values
      userGrowth = Math.min(userGrowth, 1000)
    } else if (newUsersInRangeCount > 0) {
      // If previous period was 0 but current period has users, show 100% growth
      userGrowth = 100
    }

    // Revenue from payments table (not bookings or token_transactions)
    const payments = (paymentsResult.data || []) as PaymentRow[]
    const {
      totalRevenue,
      packageRevenue,
      trialRevenue,
      paymentCount,
      tokensSold: tokensFromPayments,
    } = splitPaymentRevenue(payments)

    const tokensFromPackages = (tokensSoldResult.data || []).reduce((sum, up) => {
      const pkg = Array.isArray(up.packages) ? up.packages[0] : up.packages
      return sum + (pkg?.token_count || up.tokens_remaining || 0)
    }, 0)
    const totalTokensSold = tokensFromPackages > 0 ? tokensFromPackages : tokensFromPayments

    const previousPeriodPayments = (paymentsPreviousPeriod.data || []) as PaymentRow[]
    const previousPeriodRevenue = previousPeriodPayments.reduce(
      (sum, p) => sum + (p.amount_cents || 0),
      0
    ) / 100
    // Calculate revenue growth - cap at reasonable values
    let revenueGrowth = 0
    if (previousPeriodRevenue > 0) {
      revenueGrowth = ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue * 100)
      // Cap growth at 1000% to avoid unrealistic values
      revenueGrowth = Math.min(revenueGrowth, 1000)
    } else if (totalRevenue > 0) {
      // If previous period was 0 but current period has revenue, show 100% growth
      revenueGrowth = 100
    }

    // Attendance stats
    const bookings = bookingsResult.data || []
    const totalBookings = bookings.length
    const attended = bookings.filter(b => b.status === 'attended').length
    const noShows = bookings.filter(b => b.status === 'no-show').length
    const averageAttendance = totalBookings > 0 ? Math.round((attended / totalBookings) * 100) : 0
    const noShowRate = totalBookings > 0 ? Math.round((noShows / totalBookings) * 100) : 0
    const totalClasses = classesThisMonth.count || 0
    const avgClassSize = totalClasses > 0 
      ? Math.round(totalBookings / totalClasses)
      : 0
    
    // Calculate peak day and time from actual class data
    const classes = classesThisMonth.data || []
    const dayCounts: Record<string, number> = {}
    const timeCounts: Record<string, number> = {}
    
    for (const cls of classes) {
      if (cls.scheduled_at) {
        const classDate = new Date(cls.scheduled_at)
        const dayName = classDate.toLocaleDateString('en-US', { weekday: 'long' })
        const hour = classDate.getHours()
        const minute = classDate.getMinutes()
        const timeStr = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${minute.toString().padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
        
        dayCounts[dayName] = (dayCounts[dayName] || 0) + 1
        timeCounts[timeStr] = (timeCounts[timeStr] || 0) + 1
      }
    }
    
    const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
    const peakTime = Object.entries(timeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

    // Top instructor calculation with real student counts
    const instructorCounts: Record<string, { 
      name: string; 
      classes: number;
      studentIds: Set<string>;
    }> = {}
    
    for (const cls of topInstructorsResult.data || []) {
      const id = cls.instructor_id
      if (!instructorCounts[id]) {
        instructorCounts[id] = { 
          name: cls.instructor_name || 'Unknown', 
          classes: 0,
          studentIds: new Set(),
        }
      }
      instructorCounts[id].classes++
    }
    
    const periodBookings = periodBookingsResult.data || []

    // Fetch class metadata for bookings + top classes in parallel
    const bookingClassIds = [...new Set(periodBookings.map((b: { class_id: string }) => b.class_id).filter(Boolean))]
    const [instructorClassesRows, topClassesRows] = await Promise.all([
      bookingClassIds.length > 0
        ? fetchInBatches(bookingClassIds, async (batch) => {
            const { data } = await supabase.from(TABLES.CLASSES).select('id, instructor_id').in('id', batch)
            return data || []
          })
        : Promise.resolve([]),
      bookingClassIds.length > 0
        ? fetchInBatches(bookingClassIds, async (batch) => {
            const { data } = await supabase.from(TABLES.CLASSES).select('id, title, instructor_name').in('id', batch)
            return data || []
          })
        : Promise.resolve([]),
    ])

    const instructorClassesMap: Record<string, { instructor_id: string }> = {}
    for (const cls of instructorClassesRows) {
      instructorClassesMap[cls.id] = { instructor_id: cls.instructor_id || '' }
    }

    const classesMap: Record<string, { id: string; title: string; instructor_name: string }> = {}
    for (const cls of topClassesRows) {
      classesMap[cls.id] = {
        id: cls.id,
        title: cls.title || 'Untitled Class',
        instructor_name: cls.instructor_name || 'Unknown Instructor',
      }
    }
    
    // Count unique students per instructor from bookings
    for (const booking of periodBookings) {
      const classId = (booking as any).class_id
      const classData = classId ? instructorClassesMap[classId] : null
      const instructorId = classData?.instructor_id || null
      const userId = (booking as any).user_id || null
      
      if (instructorId && userId && instructorCounts[instructorId]) {
        instructorCounts[instructorId].studentIds.add(userId)
      }
    }
    
    const topInstructor = Object.values(instructorCounts).sort((a, b) => b.classes - a.classes)[0]?.name || 'N/A'

    // Top classes with real stats
    const classBookings: Record<string, { 
      title: string; 
      instructor: string; 
      bookings: number;
      attended: number;
      userIds: Set<string>;
    }> = {}
    
    for (const booking of periodBookings) {
      const classId = (booking as any).class_id
      const classData = classId ? classesMap[classId] : null
      
      if (classData) {
        const id = classData.id
        const title = classData.title || 'Untitled Class'
        const instructor = classData.instructor_name || 'Unknown Instructor'
        
        if (!classBookings[id]) {
          classBookings[id] = { 
            title: title, 
            instructor: instructor, 
            bookings: 0,
            attended: 0,
            userIds: new Set(),
          }
        }
        classBookings[id].bookings++
        if ((booking as any).status === 'attended') {
          classBookings[id].attended++
        }
        if ((booking as any).user_id) {
          classBookings[id].userIds.add((booking as any).user_id)
        }
      }
    }
    
    // Calculate previous period bookings for growth
    const prevPeriodBookingsCount: Record<string, number> = {}
    for (const booking of prevPeriodBookings.data || []) {
      const classId = (booking as any).class_id
      if (classId) {
        prevPeriodBookingsCount[classId] = (prevPeriodBookingsCount[classId] || 0) + 1
      }
    }
    
    // Calculate revenue per user (from payments — same rows as paymentsResult)
    const revenueByUser: Record<string, number> = {}
    for (const payment of payments) {
      const paymentData = payment as { user_id?: string; amount_cents?: number }
      if (paymentData.user_id) {
        revenueByUser[paymentData.user_id] = (revenueByUser[paymentData.user_id] || 0) + (paymentData.amount_cents || 0) / 100
      }
    }
    
    // Calculate how many classes each user booked (for revenue distribution)
    const userClassCounts: Record<string, number> = {}
    for (const data of Object.values(classBookings)) {
      for (const userId of data.userIds) {
        userClassCounts[userId] = (userClassCounts[userId] || 0) + 1
      }
    }
    
    const topClasses = Object.entries(classBookings)
      .filter(([id, data]) => data.title && data.title !== 'Untitled Class' && data.bookings > 0) // Filter out invalid entries
      .map(([id, data]) => {
        // Calculate revenue from users who booked this class
        // Distribute revenue proportionally if user booked multiple classes
        let revenue = 0
        for (const userId of data.userIds) {
          const userRevenue = revenueByUser[userId] || 0
          const userClassCount = userClassCounts[userId] || 1
          revenue += userRevenue / userClassCount
        }
        
        // Calculate growth
        const prevBookings = prevPeriodBookingsCount[id] || 0
        const growth = prevBookings > 0 
          ? Math.round(((data.bookings - prevBookings) / prevBookings) * 100)
          : data.bookings > 0 ? 100 : 0
        
        return {
          name: data.title || 'Untitled Class',
          instructor: data.instructor || 'Unknown Instructor',
          attendance: data.bookings,
          rating: null, // No rating system in database
          revenue: Math.round(revenue),
          growth: Math.min(growth, 1000), // Cap at 1000%
        }
      })
      .sort((a, b) => b.attendance - a.attendance)
      .slice(0, 5)

    // Calculate how many instructors each user booked with (for revenue distribution)
    const userInstructorCounts: Record<string, number> = {}
    for (const data of Object.values(instructorCounts)) {
      for (const userId of data.studentIds) {
        userInstructorCounts[userId] = (userInstructorCounts[userId] || 0) + 1
      }
    }
    
    // Top instructors with real stats
    const topInstructors = Object.entries(instructorCounts)
      .map(([id, data]) => {
        // Calculate revenue from students who attended instructor's classes
        // Distribute revenue proportionally if user booked with multiple instructors
        let revenue = 0
        for (const userId of data.studentIds) {
          const userRevenue = revenueByUser[userId] || 0
          const userInstructorCount = userInstructorCounts[userId] || 1
          revenue += userRevenue / userInstructorCount
        }
        
        return {
          id,
          name: data.name,
          classes: data.classes,
          students: data.studentIds.size,
          rating: null, // No rating system in database
          revenue: Math.round(revenue),
        }
      })
      .sort((a, b) => b.classes - a.classes)
      .slice(0, 4)

    const stats = {
      totalUsers,
      activeUsers,
      newUsersThisMonth: newUsersInRangeCount,
      userGrowth: Number(userGrowth.toFixed(1)),
      totalTokensSold,
      totalRevenue: Math.round(totalRevenue),
      packageRevenue: Math.round(packageRevenue),
      trialRevenue: Math.round(trialRevenue),
      paymentCount,
      totalBookings,
      revenueGrowth: Number(revenueGrowth.toFixed(1)),
      classesThisMonth: totalClasses,
      totalClasses: totalClasses,
      averageAttendance,
      noShowRate,
      topInstructor,
      avgClassSize,
      peakDay,
      peakTime,
    }

    return NextResponse.json({
      success: true,
      data: {
        periodLabel,
        year,
        month: selectedMonth,
        stats,
        monthlyData: monthlyDataResult,
        topClasses,
        topInstructors,
        recentActivity: recentActivityResult,
      },
    })
  } catch (error) {
    console.error('[Reports API] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch reports' } },
      { status: 500 }
    )
  }
}

// Monthly breakdown — 4 bulk queries for the year, aggregate in memory (not 48 sequential)
async function getMonthlyData(supabase: ReturnType<typeof getSupabaseAdminClient>, year: number) {
  const { rangeStart, rangeEnd } = getYearBoundsSgt(year)
  const startIso = rangeStart.toISOString()
  const endIso = rangeEnd.toISOString()

  const [paymentsRes, bookingsRes, usersRes, classesRes] = await Promise.all([
    supabase
      .from(TABLES.PAYMENTS)
      .select('amount_cents, package_id, is_trial_booking, created_at, packages(token_count)')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .eq('status', 'succeeded'),
    supabase
      .from(TABLES.BOOKINGS)
      .select('booked_at')
      .gte('booked_at', startIso)
      .lt('booked_at', endIso)
      .in('status', [...BOOKING_COUNT_STATUSES]),
    supabase
      .from(TABLES.USER_PROFILES)
      .select('created_at')
      .eq('role', 'user')
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from(TABLES.CLASSES)
      .select('scheduled_at')
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .in('status', ['scheduled', 'in-progress', 'completed']),
  ])

  const monthPayments = initMonthBuckets(() => [] as PaymentRow[])
  const monthBookings = initMonthBuckets(() => 0)
  const monthUsers = initMonthBuckets(() => 0)
  const monthClasses = initMonthBuckets(() => 0)

  for (const p of paymentsRes.data || []) {
    const idx = getSgtMonthNumber(p.created_at as string) - 1
    if (idx >= 0 && idx < 12) monthPayments[idx].push(p as PaymentRow)
  }
  for (const b of bookingsRes.data || []) {
    const idx = getSgtMonthNumber(b.booked_at as string) - 1
    if (idx >= 0 && idx < 12) monthBookings[idx]++
  }
  for (const u of usersRes.data || []) {
    const idx = getSgtMonthNumber(u.created_at as string) - 1
    if (idx >= 0 && idx < 12) monthUsers[idx]++
  }
  for (const c of classesRes.data || []) {
    const idx = getSgtMonthNumber(c.scheduled_at as string) - 1
    if (idx >= 0 && idx < 12) monthClasses[idx]++
  }

  const months = []
  for (let monthNumber = 1; monthNumber <= 12; monthNumber++) {
    const { monthName } = getMonthBoundsSgt(year, monthNumber)
    const idx = monthNumber - 1
    const monthRevenue = splitPaymentRevenue(monthPayments[idx])
    months.push({
      month: monthName.slice(0, 3),
      monthNumber,
      year,
      revenue: Math.round(monthRevenue.totalRevenue),
      packageRevenue: Math.round(monthRevenue.packageRevenue),
      trialRevenue: Math.round(monthRevenue.trialRevenue),
      attendance: monthBookings[idx],
      newUsers: monthUsers[idx],
      classes: monthClasses[idx],
    })
  }

  return months
}

// Helper to get recent activity within the selected period
async function getRecentActivity(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStartIso: string,
  rangeEndIso: string
) {
  const activities = []
  
  // Recent payments in period
  const { data: payments } = await supabase
    .from(TABLES.PAYMENTS)
    .select(`
      id,
      user_id,
      metadata,
      amount_cents,
      created_at,
      is_trial_booking,
      packages (
        name
      )
    `)
    .eq('status', 'succeeded')
    .gte('created_at', rangeStartIso)
    .lt('created_at', rangeEndIso)
    .order('created_at', { ascending: false })
    .limit(3)
  
  // Get user profiles for payments
  const paymentUserIds = (payments || []).map(p => p.user_id).filter(Boolean)
  const { data: paymentProfiles } = paymentUserIds.length > 0 
    ? await supabase.from(TABLES.USER_PROFILES).select('id, name').in('id', paymentUserIds)
    : { data: [] }
  
  const profileMap: Record<string, string> = {}
  for (const p of paymentProfiles || []) {
    profileMap[p.id] = p.name
  }
  
  for (const payment of payments || []) {
    const packagesData = payment.packages as { name: string }[] | { name: string } | null
    const pkg = Array.isArray(packagesData) ? packagesData[0] : packagesData
    const metadata = (payment.metadata as {
      parent_name?: string
      guest_name?: string
      child_name?: string
      package_label?: string
      flow_type?: string
    } | null) || {}
    const fallbackName =
      metadata.parent_name ||
      metadata.guest_name ||
      metadata.child_name ||
      null
    const isTrial = payment.is_trial_booking
    const purchaseLabel =
      pkg?.name ||
      metadata.package_label ||
      (metadata.flow_type === 'zumfamilia' ? 'ZumFamilia package' : isTrial ? 'trial class' : 'package')

    activities.push({
      type: 'purchase',
      user: (payment.user_id ? profileMap[payment.user_id] : null) || fallbackName || 'User',
      detail: isTrial ? `Paid for ${purchaseLabel}` : `Purchased ${purchaseLabel}`,
      time: getRelativeTime(new Date(payment.created_at)),
      amount: Math.round((payment.amount_cents || 0) / 100),
    })
  }
  
  // Recent signups in period (only customers, not staff)
  const { data: newUsers } = await supabase
    .from(TABLES.USER_PROFILES)
    .select('id, name, created_at')
    .eq('role', 'user')
    .gte('created_at', rangeStartIso)
    .lt('created_at', rangeEndIso)
    .order('created_at', { ascending: false })
    .limit(2)
  
  for (const user of newUsers || []) {
    activities.push({
      type: 'signup',
      user: user.name,
      detail: 'New user registration',
      time: getRelativeTime(new Date(user.created_at)),
      amount: null,
    })
  }
  
  // Sort by time (most recent first)
  return activities.slice(0, 5)
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}
