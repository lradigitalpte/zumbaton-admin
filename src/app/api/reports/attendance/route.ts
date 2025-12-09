/**
 * Attendance Reports API
 * GET /api/reports/attendance - Get detailed attendance analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(request.url)
    
    const range = searchParams.get('range') || 'month' // week, month, quarter, year
    const view = searchParams.get('view') || 'overview' // overview, classes, users
    
    // Calculate date ranges
    const now = new Date()
    
    let rangeStart: Date
    let monthsToShow = 7
    switch (range) {
      case 'week':
        rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        monthsToShow = 1
        break
      case 'quarter':
        rangeStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        monthsToShow = 3
        break
      case 'year':
        rangeStart = new Date(now.getFullYear(), 0, 1)
        monthsToShow = 12
        break
      default: // month
        rangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        monthsToShow = 7
    }

    // Get attendance totals
    const { data: bookings } = await supabase
      .from(TABLES.BOOKINGS)
      .select('id, status, user_id, class_id, booked_at')
      .gte('booked_at', rangeStart.toISOString())
    
    const totalBooked = (bookings || []).length
    const attended = (bookings || []).filter(b => b.status === 'attended').length
    const noShows = (bookings || []).filter(b => b.status === 'no-show').length
    const cancelled = (bookings || []).filter(b => b.status === 'cancelled').length
    
    const overallRate = totalBooked > 0 ? Math.round((attended / totalBooked) * 100) : 0
    const noShowRate = totalBooked > 0 ? Math.round((noShows / totalBooked) * 100) : 0

    // Get weekly breakdown
    const weeklyData = await getWeeklyBreakdown(supabase, rangeStart)
    
    // Get time slot data
    const timeSlotData = await getTimeSlotData(supabase, rangeStart)
    
    // Get class performance
    const classPerformance = await getClassPerformance(supabase, rangeStart)
    
    // Get frequent no-shows
    const frequentNoShows = await getFrequentNoShows(supabase, rangeStart)
    
    // Get monthly trends
    const monthlyTrends = await getMonthlyTrends(supabase, monthsToShow)

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          totalBooked,
          totalAttended: attended,
          totalNoShows: noShows,
          totalCancelled: cancelled,
          overallRate,
          noShowRate,
        },
        weeklyData,
        timeSlotData,
        classPerformance,
        frequentNoShows,
        monthlyTrends,
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

async function getWeeklyBreakdown(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStart: Date
) {
  // Get bookings with class info to determine day of week
  const { data: bookings } = await supabase
    .from(TABLES.BOOKINGS)
    .select(`
      id,
      status,
      class_id,
      classes (
        scheduled_at
      )
    `)
    .gte('booked_at', rangeStart.toISOString())
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayStats: Record<string, { classes: Set<string>; booked: number; attended: number; noShows: number; cancelled: number }> = {}
  
  for (const day of days) {
    dayStats[day] = { classes: new Set(), booked: 0, attended: 0, noShows: 0, cancelled: 0 }
  }
  
  for (const booking of bookings || []) {
    const classesData = booking.classes as { scheduled_at: string }[] | { scheduled_at: string } | null
    const cls = Array.isArray(classesData) ? classesData[0] : classesData
    if (cls?.scheduled_at) {
      const dayOfWeek = days[new Date(cls.scheduled_at).getDay()]
      dayStats[dayOfWeek].classes.add(booking.class_id)
      dayStats[dayOfWeek].booked++
      
      if (booking.status === 'attended') dayStats[dayOfWeek].attended++
      else if (booking.status === 'no-show') dayStats[dayOfWeek].noShows++
      else if (booking.status === 'cancelled') dayStats[dayOfWeek].cancelled++
    }
  }
  
  // Return Monday-Sunday order
  const orderedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  return orderedDays.map(day => {
    const stats = dayStats[day]
    const rate = stats.booked > 0 ? Math.round((stats.attended / stats.booked) * 100) : 0
    return {
      day,
      classes: stats.classes.size,
      booked: stats.booked,
      attended: stats.attended,
      noShows: stats.noShows,
      cancelled: stats.cancelled,
      rate,
    }
  })
}

async function getTimeSlotData(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStart: Date
) {
  // Get classes with booking stats
  const { data: classes } = await supabase
    .from(TABLES.CLASSES)
    .select('id, scheduled_at, capacity')
    .gte('scheduled_at', rangeStart.toISOString())
  
  // Get bookings
  const { data: bookings } = await supabase
    .from(TABLES.BOOKINGS)
    .select('class_id, status')
    .gte('booked_at', rangeStart.toISOString())
  
  // Group by hour
  const hourStats: Record<string, { classes: number; totalAttendance: number; totalBooked: number }> = {}
  
  for (const cls of classes || []) {
    const hour = new Date(cls.scheduled_at).getHours()
    const slot = `${hour}:00 ${hour < 12 ? 'AM' : 'PM'}`
    const formattedSlot = hour === 0 ? '12:00 AM' : 
                         hour < 12 ? `${hour}:00 AM` : 
                         hour === 12 ? '12:00 PM' : 
                         `${hour - 12}:00 PM`
    
    if (!hourStats[formattedSlot]) {
      hourStats[formattedSlot] = { classes: 0, totalAttendance: 0, totalBooked: 0 }
    }
    hourStats[formattedSlot].classes++
    
    // Count bookings for this class
    const classBookings = (bookings || []).filter(b => b.class_id === cls.id)
    hourStats[formattedSlot].totalBooked += classBookings.length
    hourStats[formattedSlot].totalAttendance += classBookings.filter(b => b.status === 'attended').length
  }
  
  // Convert to array
  return Object.entries(hourStats)
    .map(([slot, stats]) => ({
      slot,
      classes: stats.classes,
      avgAttendance: stats.classes > 0 ? Math.round(stats.totalAttendance / stats.classes) : 0,
      rate: stats.totalBooked > 0 ? Math.round((stats.totalAttendance / stats.totalBooked) * 100) : 0,
    }))
    .filter(s => s.classes > 0)
    .sort((a, b) => {
      // Sort by hour
      const parseHour = (slot: string) => {
        const match = slot.match(/(\d+)/)
        const hour = parseInt(match?.[1] || '0')
        return slot.includes('PM') && hour !== 12 ? hour + 12 : hour
      }
      return parseHour(a.slot) - parseHour(b.slot)
    })
}

async function getClassPerformance(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStart: Date
) {
  // Get classes with their bookings
  const { data: classes } = await supabase
    .from(TABLES.CLASSES)
    .select('id, title, instructor_name, capacity')
    .gte('scheduled_at', rangeStart.toISOString())
  
  const { data: bookings } = await supabase
    .from(TABLES.BOOKINGS)
    .select('class_id, status')
    .gte('booked_at', rangeStart.toISOString())
  
  // Group classes by title
  const classStats: Record<string, {
    instructor: string
    totalClasses: number
    totalCapacity: number
    attended: number
    noShows: number
    booked: number
  }> = {}
  
  for (const cls of classes || []) {
    if (!classStats[cls.title]) {
      classStats[cls.title] = {
        instructor: cls.instructor_name || 'Unknown',
        totalClasses: 0,
        totalCapacity: 0,
        attended: 0,
        noShows: 0,
        booked: 0,
      }
    }
    classStats[cls.title].totalClasses++
    classStats[cls.title].totalCapacity += cls.capacity || 20
    
    // Count bookings for this class
    const classBookings = (bookings || []).filter(b => b.class_id === cls.id)
    classStats[cls.title].booked += classBookings.length
    classStats[cls.title].attended += classBookings.filter(b => b.status === 'attended').length
    classStats[cls.title].noShows += classBookings.filter(b => b.status === 'no-show').length
  }
  
  return Object.entries(classStats)
    .map(([name, stats]) => {
      const avgAttendance = stats.totalClasses > 0 ? Math.round(stats.attended / stats.totalClasses) : 0
      const capacity = stats.totalClasses > 0 ? Math.round(stats.totalCapacity / stats.totalClasses) : 20
      const rate = stats.booked > 0 ? Math.round((stats.attended / stats.booked) * 100) : 0
      const noShowRate = stats.booked > 0 ? Math.round((stats.noShows / stats.booked) * 100) : 0
      
      return {
        name,
        instructor: stats.instructor,
        totalClasses: stats.totalClasses,
        avgAttendance,
        capacity,
        rate,
        noShowRate,
      }
    })
    .sort((a, b) => b.totalClasses - a.totalClasses)
    .slice(0, 10)
}

async function getFrequentNoShows(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStart: Date
) {
  // Get no-show bookings
  const { data: noShowBookings } = await supabase
    .from(TABLES.BOOKINGS)
    .select('user_id, booked_at')
    .eq('status', 'no-show')
    .gte('booked_at', rangeStart.toISOString())
  
  // Get all bookings for the same users
  const { data: allBookings } = await supabase
    .from(TABLES.BOOKINGS)
    .select('user_id, status, booked_at')
    .gte('booked_at', rangeStart.toISOString())
  
  // Group by user
  const userStats: Record<string, { noShows: number; totalBookings: number; lastNoShow: string }> = {}
  
  for (const booking of noShowBookings || []) {
    const userId = booking.user_id
    if (!userStats[userId]) {
      userStats[userId] = { noShows: 0, totalBookings: 0, lastNoShow: booking.booked_at }
    }
    userStats[userId].noShows++
    if (new Date(booking.booked_at) > new Date(userStats[userId].lastNoShow)) {
      userStats[userId].lastNoShow = booking.booked_at
    }
  }
  
  // Count total bookings per user
  for (const booking of allBookings || []) {
    if (userStats[booking.user_id]) {
      userStats[booking.user_id].totalBookings++
    }
  }
  
  // Get top no-show users
  const topNoShowUsers = Object.entries(userStats)
    .filter(([, stats]) => stats.noShows >= 3) // At least 3 no-shows
    .sort((a, b) => b[1].noShows - a[1].noShows)
    .slice(0, 5)
    .map(([userId]) => userId)
  
  if (topNoShowUsers.length === 0) {
    return []
  }
  
  // Fetch user profiles (only customers, not staff)
  const { data: profiles } = await supabase
    .from(TABLES.USER_PROFILES)
    .select('id, name, email')
    .in('id', topNoShowUsers)
    .eq('role', 'user')
  
  const profileMap: Record<string, { name: string; email: string }> = {}
  for (const p of profiles || []) {
    profileMap[p.id] = { name: p.name, email: p.email }
  }
  
  // Only return users that are customers
  return topNoShowUsers
    .filter(userId => profileMap[userId])
    .map(userId => {
    const stats = userStats[userId]
    return {
      name: profileMap[userId]?.name || 'Unknown',
      email: profileMap[userId]?.email || 'unknown@email.com',
      noShows: stats.noShows,
      totalBookings: stats.totalBookings,
      rate: stats.totalBookings > 0 ? Math.round((stats.noShows / stats.totalBookings) * 100) : 0,
      lastNoShow: stats.lastNoShow.split('T')[0],
    }
  })
}

async function getMonthlyTrends(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  monthsToShow: number
) {
  const trends = []
  const now = new Date()
  
  for (let i = monthsToShow - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    
    const monthName = date.toLocaleDateString('en-US', { month: 'short' })
    
    // Get bookings for this month
    const { data: bookings } = await supabase
      .from(TABLES.BOOKINGS)
      .select('status')
      .gte('booked_at', date.toISOString())
      .lt('booked_at', nextMonth.toISOString())
    
    const attended = (bookings || []).filter(b => b.status === 'attended').length
    const noShows = (bookings || []).filter(b => b.status === 'no-show').length
    const cancelled = (bookings || []).filter(b => b.status === 'cancelled').length
    const total = attended + noShows + cancelled
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0
    
    trends.push({
      month: monthName,
      attendance: attended,
      noShows,
      cancellations: cancelled,
      rate,
    })
  }
  
  return trends
}
