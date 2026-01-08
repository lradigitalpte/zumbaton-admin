/**
 * Reports Overview API
 * GET /api/reports - Get dashboard overview stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'

// GET /api/reports - Get overview statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(request.url)
    
    const range = searchParams.get('range') || 'month' // week, month, quarter, year
    
    // Calculate date ranges
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    
    // Get range start date
    let rangeStart: Date
    switch (range) {
      case 'week':
        rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'quarter':
        rangeStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        break
      case 'year':
        rangeStart = new Date(now.getFullYear(), 0, 1)
        break
      default: // month
        rangeStart = startOfMonth
    }

    // Staff roles to exclude from user counts (only count customers/members)
    const staffRoles = ['super_admin', 'admin', 'instructor', 'staff', 'receptionist']

    // Fetch all required data in parallel
    const [
      usersResult,
      activeUsersResult,
      newUsersInRange,
      newUsersPreviousPeriod,
      paymentsResult,
      paymentsPreviousPeriod,
      classesThisMonth,
      bookingsResult,
      attendanceResult,
      topInstructorsResult,
      topClassesResult,
      paymentsForRevenue,
      instructorBookings,
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
        .gte('booked_at', rangeStart.toISOString())
        .not('user_id', 'is', null),
      
      // New users in range (only customers, exclude staff)
      supabase
        .from(TABLES.USER_PROFILES)
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .gte('created_at', rangeStart.toISOString()),
      
      // New users in previous period (for comparison)
      supabase
        .from(TABLES.USER_PROFILES)
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .gte('created_at', new Date(rangeStart.getTime() - (range === 'week' ? 7 : range === 'month' ? 30 : range === 'quarter' ? 90 : 365) * 24 * 60 * 60 * 1000).toISOString())
        .lt('created_at', rangeStart.toISOString()),
      
      // Payments in range
      supabase
        .from(TABLES.PAYMENTS)
        .select('id, amount_cents, currency, created_at')
        .gte('created_at', rangeStart.toISOString())
        .eq('status', 'succeeded'),
      
      // Payments in previous period (for comparison)
      supabase
        .from(TABLES.PAYMENTS)
        .select('id, amount_cents')
        .gte('created_at', new Date(rangeStart.getTime() - (range === 'week' ? 7 : range === 'month' ? 30 : range === 'quarter' ? 90 : 365) * 24 * 60 * 60 * 1000).toISOString())
        .lt('created_at', rangeStart.toISOString())
        .eq('status', 'succeeded'),
      
      // Classes in range
      supabase
        .from(TABLES.CLASSES)
        .select('id, scheduled_at', { count: 'exact' })
        .gte('scheduled_at', rangeStart.toISOString())
        .in('status', ['scheduled', 'in-progress', 'completed']),
      
      // Bookings for attendance stats
      supabase
        .from(TABLES.BOOKINGS)
        .select('id, status')
        .gte('booked_at', rangeStart.toISOString()),
      
      // Actual attendance
      supabase
        .from(TABLES.ATTENDANCES)
        .select('id')
        .gte('checked_in_at', rangeStart.toISOString()),
      
      // Top instructors by class count
      supabase
        .from(TABLES.CLASSES)
        .select('id, instructor_id, instructor_name')
        .gte('scheduled_at', rangeStart.toISOString())
        .not('instructor_id', 'is', null),
      
      // Get bookings for instructors to calculate students
      supabase
        .from(TABLES.BOOKINGS)
        .select('class_id, user_id, status')
        .gte('booked_at', rangeStart.toISOString())
        .not('class_id', 'is', null),
      
      // Top classes by bookings with payment data
      supabase
        .from(TABLES.BOOKINGS)
        .select('class_id, user_id, status')
        .gte('booked_at', rangeStart.toISOString())
        .not('class_id', 'is', null),
      
      // Get payments for revenue calculation
      supabase
        .from(TABLES.PAYMENTS)
        .select('id, amount_cents, user_id, created_at')
        .gte('created_at', rangeStart.toISOString())
        .eq('status', 'succeeded'),
      
      // Get previous period bookings for growth calculation
      supabase
        .from(TABLES.BOOKINGS)
        .select('class_id')
        .gte('booked_at', new Date(rangeStart.getTime() - (range === 'week' ? 7 : range === 'month' ? 30 : range === 'quarter' ? 90 : 365) * 24 * 60 * 60 * 1000).toISOString())
        .lt('booked_at', rangeStart.toISOString())
        .not('class_id', 'is', null),
      
      // Monthly data for chart (based on range)
      getMonthlyData(supabase, range),
      
      // Recent activity
      getRecentActivity(supabase),
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

    // Revenue calculations
    const payments = paymentsResult.data || []
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
    const totalTokensSold = payments.length * 10 // Estimate based on avg package size
    
    const previousPeriodPayments = paymentsPreviousPeriod.data || []
    const previousPeriodRevenue = previousPeriodPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
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
      ? Math.round(attended / totalClasses)
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
    
    // Fetch classes for instructor bookings to get instructor_id
    const instructorBookingClassIds = [...new Set((instructorBookings.data || []).map((b: any) => b.class_id).filter(Boolean))]
    let instructorClassesMap: Record<string, { instructor_id: string }> = {}
    
    if (instructorBookingClassIds.length > 0) {
      const { data: instructorClassesData } = await supabase
        .from(TABLES.CLASSES)
        .select('id, instructor_id')
        .in('id', instructorBookingClassIds)
      
      if (instructorClassesData) {
        for (const cls of instructorClassesData) {
          instructorClassesMap[cls.id] = {
            instructor_id: cls.instructor_id || '',
          }
        }
      }
    }
    
    // Count unique students per instructor from bookings
    for (const booking of instructorBookings.data || []) {
      const classId = (booking as any).class_id
      const classData = classId ? instructorClassesMap[classId] : null
      const instructorId = classData?.instructor_id || null
      const userId = (booking as any).user_id || null
      
      if (instructorId && userId && instructorCounts[instructorId]) {
        instructorCounts[instructorId].studentIds.add(userId)
      }
    }
    
    const topInstructor = Object.values(instructorCounts).sort((a, b) => b.classes - a.classes)[0]?.name || 'N/A'

    // Fetch classes separately for top classes calculation
    const uniqueClassIds = [...new Set((topClassesResult.data || []).map((b: any) => b.class_id).filter(Boolean))]
    let classesMap: Record<string, { id: string; title: string; instructor_name: string }> = {}
    
    if (uniqueClassIds.length > 0) {
      const { data: classesData } = await supabase
        .from(TABLES.CLASSES)
        .select('id, title, instructor_name')
        .in('id', uniqueClassIds)
      
      if (classesData) {
        for (const cls of classesData) {
          classesMap[cls.id] = {
            id: cls.id,
            title: cls.title || 'Untitled Class',
            instructor_name: cls.instructor_name || 'Unknown Instructor',
          }
        }
      }
    }
    
    // Top classes with real stats
    const classBookings: Record<string, { 
      title: string; 
      instructor: string; 
      bookings: number;
      attended: number;
      userIds: Set<string>;
    }> = {}
    
    for (const booking of topClassesResult.data || []) {
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
    
    // Calculate revenue per user (from payments)
    const revenueByUser: Record<string, number> = {}
    for (const payment of paymentsForRevenue.data || []) {
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
          attendance: data.attended,
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

// Helper to get monthly data based on range
async function getMonthlyData(supabase: ReturnType<typeof getSupabaseAdminClient>, range: string) {
  const months = []
  const now = new Date()
  
  // Calculate range start date (same logic as main function)
  let rangeStart: Date
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  switch (range) {
    case 'week':
      rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'quarter':
      rangeStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      break
    case 'year':
      rangeStart = new Date(now.getFullYear(), 0, 1)
      break
    default: // month
      rangeStart = startOfMonth
  }
  
  // Determine which months to show based on range
  let monthsToShow: Array<{ month: number; year: number }> = []
  
  if (range === 'week') {
    // For week, show just the current month
    monthsToShow = [{ month: now.getMonth(), year: now.getFullYear() }]
  } else if (range === 'quarter') {
    // For quarter, show the 3 months in the quarter
    const quarterStart = Math.floor(now.getMonth() / 3) * 3
    for (let i = 0; i < 3; i++) {
      monthsToShow.push({ month: quarterStart + i, year: now.getFullYear() })
    }
  } else if (range === 'year') {
    // For year, show all 12 months
    for (let i = 0; i < 12; i++) {
      monthsToShow.push({ month: i, year: now.getFullYear() })
    }
  } else {
    // For month, show last 7 months for context
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthsToShow.push({ month: date.getMonth(), year: date.getFullYear() })
    }
  }
  
  for (const { month, year } of monthsToShow) {
    const date = new Date(year, month, 1)
    const nextMonth = new Date(year, month + 1, 1)
    const monthEnd = nextMonth > now ? now : nextMonth
    
    // Only include data if it's within the selected range
    if (date < rangeStart && nextMonth <= rangeStart) {
      // Skip months completely before the range
      continue
    }
    
    const monthName = date.toLocaleDateString('en-US', { month: 'short' })
    
    // Calculate the actual date range for this month within the selected range
    const monthStartDate = date >= rangeStart ? date : rangeStart
    const monthEndDate = monthEnd
    
    // Get payments for this month (within range)
    const { data: payments } = await supabase
      .from(TABLES.PAYMENTS)
      .select('amount_cents')
      .gte('created_at', monthStartDate.toISOString())
      .lt('created_at', monthEndDate.toISOString())
      .eq('status', 'succeeded')
    
    // Get bookings/attendance for this month (within range)
    const { data: bookings } = await supabase
      .from(TABLES.BOOKINGS)
      .select('status')
      .gte('booked_at', monthStartDate.toISOString())
      .lt('booked_at', monthEndDate.toISOString())
    
    // Get new users for this month (within range, only customers, exclude staff)
    const { count: newUsers } = await supabase
      .from(TABLES.USER_PROFILES)
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .gte('created_at', monthStartDate.toISOString())
      .lt('created_at', monthEndDate.toISOString())
    
    // Get classes for this month (within range)
    const { count: classes } = await supabase
      .from(TABLES.CLASSES)
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', monthStartDate.toISOString())
      .lt('scheduled_at', monthEndDate.toISOString())
      .in('status', ['scheduled', 'in-progress', 'completed'])
    
    const revenue = (payments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
    const attendance = (bookings || []).filter(b => b.status === 'attended').length
    
    months.push({
      month: monthName,
      year: year,
      revenue: Math.round(revenue),
      attendance,
      newUsers: newUsers || 0,
      classes: classes || 0,
    })
  }
  
  return months
}

// Helper to get recent activity
async function getRecentActivity(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  const activities = []
  
  // Recent payments
  const { data: payments } = await supabase
    .from(TABLES.PAYMENTS)
    .select(`
      id,
      user_id,
      amount_cents,
      created_at,
      packages (
        name
      )
    `)
    .eq('status', 'succeeded')
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
    activities.push({
      type: 'purchase',
      user: profileMap[payment.user_id] || 'User',
      detail: `Purchased ${pkg?.name || 'package'}`,
      time: getRelativeTime(new Date(payment.created_at)),
      amount: Math.round((payment.amount_cents || 0) / 100),
    })
  }
  
  // Recent signups (only customers, not staff)
  const { data: newUsers } = await supabase
    .from(TABLES.USER_PROFILES)
    .select('id, name, created_at')
    .eq('role', 'user')
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
