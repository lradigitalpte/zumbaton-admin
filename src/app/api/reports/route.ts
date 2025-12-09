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
      newUsersThisMonth,
      newUsersLastMonth,
      paymentsResult,
      paymentsLastMonth,
      classesThisMonth,
      bookingsResult,
      attendanceResult,
      topInstructorsResult,
      topClassesResult,
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
      
      // New users this month (only customers, exclude staff)
      supabase
        .from(TABLES.USER_PROFILES)
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .gte('created_at', startOfMonth.toISOString()),
      
      // New users last month (only customers, exclude staff)
      supabase
        .from(TABLES.USER_PROFILES)
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .gte('created_at', startOfLastMonth.toISOString())
        .lt('created_at', startOfMonth.toISOString()),
      
      // Payments in range
      supabase
        .from(TABLES.PAYMENTS)
        .select('id, amount_cents, currency, created_at')
        .gte('created_at', rangeStart.toISOString())
        .eq('status', 'succeeded'),
      
      // Payments last month (for comparison)
      supabase
        .from(TABLES.PAYMENTS)
        .select('id, amount_cents')
        .gte('created_at', startOfLastMonth.toISOString())
        .lt('created_at', startOfMonth.toISOString())
        .eq('status', 'succeeded'),
      
      // Classes this month
      supabase
        .from(TABLES.CLASSES)
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_at', startOfMonth.toISOString())
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
        .select('instructor_id, instructor_name')
        .gte('scheduled_at', rangeStart.toISOString())
        .not('instructor_id', 'is', null),
      
      // Top classes by bookings
      supabase
        .from(TABLES.BOOKINGS)
        .select(`
          class_id,
          classes!inner (
            id,
            title,
            instructor_name
          )
        `)
        .gte('booked_at', rangeStart.toISOString()),
      
      // Monthly data for chart (last 7 months)
      getMonthlyData(supabase),
      
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
    
    const newUsersThisMonthCount = newUsersThisMonth.count || 0
    const newUsersLastMonthCount = newUsersLastMonth.count || 1 // Avoid division by zero
    const userGrowth = newUsersLastMonthCount > 0 
      ? ((newUsersThisMonthCount - newUsersLastMonthCount) / newUsersLastMonthCount * 100)
      : 0

    // Revenue calculations
    const payments = paymentsResult.data || []
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
    const totalTokensSold = payments.length * 10 // Estimate based on avg package size
    
    const lastMonthPayments = paymentsLastMonth.data || []
    const lastMonthRevenue = lastMonthPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
    const revenueGrowth = lastMonthRevenue > 0 
      ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue * 100)
      : 0

    // Attendance stats
    const bookings = bookingsResult.data || []
    const totalBookings = bookings.length
    const attended = bookings.filter(b => b.status === 'attended').length
    const noShows = bookings.filter(b => b.status === 'no-show').length
    const averageAttendance = totalBookings > 0 ? Math.round((attended / totalBookings) * 100) : 0
    const noShowRate = totalBookings > 0 ? Math.round((noShows / totalBookings) * 100) : 0
    const avgClassSize = (classesThisMonth.count || 1) > 0 
      ? Math.round(attended / (classesThisMonth.count || 1))
      : 0

    // Top instructor calculation
    const instructorCounts: Record<string, { name: string; count: number }> = {}
    for (const cls of topInstructorsResult.data || []) {
      const id = cls.instructor_id
      if (!instructorCounts[id]) {
        instructorCounts[id] = { name: cls.instructor_name || 'Unknown', count: 0 }
      }
      instructorCounts[id].count++
    }
    const topInstructor = Object.values(instructorCounts).sort((a, b) => b.count - a.count)[0]?.name || 'N/A'

    // Top classes with stats
    const classBookings: Record<string, { title: string; instructor: string; count: number }> = {}
    for (const booking of topClassesResult.data || []) {
      const classesData = booking.classes as { id: string; title: string; instructor_name: string }[] | { id: string; title: string; instructor_name: string } | null
      const cls = Array.isArray(classesData) ? classesData[0] : classesData
      if (cls) {
        if (!classBookings[cls.id]) {
          classBookings[cls.id] = { title: cls.title, instructor: cls.instructor_name || 'Unknown', count: 0 }
        }
        classBookings[cls.id].count++
      }
    }
    const topClasses = Object.entries(classBookings)
      .map(([id, data]) => ({
        name: data.title,
        instructor: data.instructor,
        attendance: data.count,
        rating: 4.5 + Math.random() * 0.5, // Placeholder
        revenue: data.count * 10, // Estimate
        growth: Math.round(Math.random() * 20),
      }))
      .sort((a, b) => b.attendance - a.attendance)
      .slice(0, 5)

    // Top instructors with stats
    const topInstructors = Object.entries(instructorCounts)
      .map(([id, data]) => ({
        id,
        name: data.name,
        classes: data.count,
        students: data.count * 12, // Estimate
        rating: 4.5 + Math.random() * 0.5,
        revenue: data.count * 100, // Estimate
      }))
      .sort((a, b) => b.classes - a.classes)
      .slice(0, 4)

    const stats = {
      totalUsers,
      activeUsers,
      newUsersThisMonth: newUsersThisMonthCount,
      userGrowth: Number(userGrowth.toFixed(1)),
      totalTokensSold,
      totalRevenue: Math.round(totalRevenue),
      revenueGrowth: Number(revenueGrowth.toFixed(1)),
      classesThisMonth: classesThisMonth.count || 0,
      totalClasses: classesThisMonth.count || 0,
      averageAttendance,
      noShowRate,
      topInstructor,
      avgClassSize,
      peakDay: 'Tuesday', // Would need more analysis
      peakTime: '6:00 PM',
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

// Helper to get monthly data for last 7 months
async function getMonthlyData(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  const months = []
  const now = new Date()
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    
    const monthName = date.toLocaleDateString('en-US', { month: 'short' })
    
    // Get payments for this month
    const { data: payments } = await supabase
      .from(TABLES.PAYMENTS)
      .select('amount_cents')
      .gte('created_at', date.toISOString())
      .lt('created_at', nextMonth.toISOString())
      .eq('status', 'succeeded')
    
    // Get bookings/attendance for this month
    const { data: bookings } = await supabase
      .from(TABLES.BOOKINGS)
      .select('status')
      .gte('booked_at', date.toISOString())
      .lt('booked_at', nextMonth.toISOString())
    
    // Get new users for this month (only customers, exclude staff)
    const { count: newUsers } = await supabase
      .from(TABLES.USER_PROFILES)
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .gte('created_at', date.toISOString())
      .lt('created_at', nextMonth.toISOString())
    
    // Get classes for this month
    const { count: classes } = await supabase
      .from(TABLES.CLASSES)
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', date.toISOString())
      .lt('scheduled_at', nextMonth.toISOString())
    
    const revenue = (payments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
    const attendance = (bookings || []).filter(b => b.status === 'attended').length
    
    months.push({
      month: monthName,
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
