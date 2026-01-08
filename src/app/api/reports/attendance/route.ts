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

    // Get attendance totals - count bookings for classes scheduled in the range (not when booking was made)
    // First get classes scheduled in the range
    const { data: classes } = await supabase
      .from(TABLES.CLASSES)
      .select('id')
      .gte('scheduled_at', rangeStart.toISOString())
    
    const classIds = (classes || []).map(c => c.id)
    
    // Then get bookings for those classes
    let bookings: Array<{ status: string }> = []
    if (classIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from(TABLES.BOOKINGS)
        .select('id, status, user_id, class_id')
        .in('class_id', classIds)
      
      bookings = bookingsData || []
    }
    
    const totalBooked = bookings.length
    const attended = bookings.filter(b => b.status === 'attended').length
    const noShows = bookings.filter(b => b.status === 'no-show').length
    const cancelled = bookings.filter(b => ['cancelled', 'cancelled-late'].includes(b.status)).length
    
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
    
    // Get monthly trends (pass range to filter properly)
    const monthlyTrends = await getMonthlyTrends(supabase, range, rangeStart, now)

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
  // Get classes scheduled in the range
  const { data: classes } = await supabase
    .from(TABLES.CLASSES)
    .select('id, scheduled_at')
    .gte('scheduled_at', rangeStart.toISOString())
  
  const classIds = (classes || []).map(c => c.id)
  
  // Get bookings for those classes
  let bookings: Array<{ class_id: string; status: string }> = []
  if (classIds.length > 0) {
    const { data: bookingsData } = await supabase
      .from(TABLES.BOOKINGS)
      .select('id, status, class_id')
      .in('class_id', classIds)
    
    bookings = bookingsData || []
  }
  
  // Create a map of class_id to scheduled_at
  const classScheduleMap: Record<string, string> = {}
  for (const cls of classes || []) {
    classScheduleMap[cls.id] = cls.scheduled_at
  }
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayStats: Record<string, { classes: Set<string>; booked: number; attended: number; noShows: number; cancelled: number }> = {}
  
  for (const day of days) {
    dayStats[day] = { classes: new Set(), booked: 0, attended: 0, noShows: 0, cancelled: 0 }
  }
  
  for (const booking of bookings) {
    const scheduledAt = classScheduleMap[booking.class_id]
    if (scheduledAt) {
      const dayOfWeek = days[new Date(scheduledAt).getDay()]
      dayStats[dayOfWeek].classes.add(booking.class_id)
      dayStats[dayOfWeek].booked++
      
      if (booking.status === 'attended') dayStats[dayOfWeek].attended++
      else if (booking.status === 'no-show') dayStats[dayOfWeek].noShows++
      else if (['cancelled', 'cancelled-late'].includes(booking.status)) dayStats[dayOfWeek].cancelled++
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
  const now = new Date()
  
  // Get classes scheduled in the range (include both past and future)
  const { data: classes } = await supabase
    .from(TABLES.CLASSES)
    .select('id, scheduled_at, capacity')
    .gte('scheduled_at', rangeStart.toISOString())
  
  const classIds = (classes || []).map(c => c.id)
  
  // Get bookings for those classes with their attendance status
  let bookings: Array<{ id: string; class_id: string; status: string }> = []
  let attendanceMap: Record<string, boolean> = {} // booking_id -> has attendance record
  
  if (classIds.length > 0) {
    // Get bookings
    const { data: bookingsData } = await supabase
      .from(TABLES.BOOKINGS)
      .select('id, class_id, status')
      .in('class_id', classIds)
    
    bookings = bookingsData || []
    
    // Get attendance records to check actual check-ins
    const bookingIds = bookings.map(b => b.id)
    if (bookingIds.length > 0) {
      const { data: attendances } = await supabase
        .from('attendances')
        .select('booking_id')
        .in('booking_id', bookingIds)
      
      // Create a map of booking IDs that have attendance records
      for (const att of attendances || []) {
        attendanceMap[att.booking_id] = true
      }
    }
  }
  
  // Group by hour
  const hourStats: Record<string, { 
    classes: number
    pastClasses: number
    totalAttendance: number
    totalBooked: number
  }> = {}
  
  // Create a map of class_id to bookings for faster lookup
  const bookingsByClass: Record<string, Array<{ id: string; status: string }>> = {}
  for (const booking of bookings) {
    if (!bookingsByClass[booking.class_id]) {
      bookingsByClass[booking.class_id] = []
    }
    bookingsByClass[booking.class_id].push(booking)
  }
  
  for (const cls of classes || []) {
    const scheduledDate = new Date(cls.scheduled_at)
    const hour = scheduledDate.getHours()
    const isPastClass = scheduledDate <= now
    
    // Group by hour only (not by exact minute)
    const formattedSlot = hour === 0 ? '12:00 AM' : 
                         hour < 12 ? `${hour}:00 AM` : 
                         hour === 12 ? '12:00 PM' : 
                         `${hour - 12}:00 PM`
    
    if (!hourStats[formattedSlot]) {
      hourStats[formattedSlot] = { 
        classes: 0, 
        pastClasses: 0,
        totalAttendance: 0, 
        totalBooked: 0 
      }
    }
    hourStats[formattedSlot].classes++
    if (isPastClass) {
      hourStats[formattedSlot].pastClasses++
    }
    
    // Only count bookings and attendance for past classes (future classes can't have attendance yet)
    if (isPastClass) {
      // Count bookings for this class
      const classBookings = bookingsByClass[cls.id] || []
      // Filter out cancelled bookings for "booked" count
      const activeBookings = classBookings.filter(b => 
        !['cancelled', 'cancelled-late'].includes(b.status)
      )
      hourStats[formattedSlot].totalBooked += activeBookings.length
      
      // Count attendance: either status is 'attended' OR has an attendance record
      const attendedCount = activeBookings.filter(b => 
        b.status === 'attended' || attendanceMap[b.id] === true
      ).length
      hourStats[formattedSlot].totalAttendance += attendedCount
    }
  }
  
  // Convert to array and calculate rates properly
  return Object.entries(hourStats)
    .map(([slot, stats]) => {
      // Only calculate rate for time slots with past classes that have bookings
      const rate = stats.pastClasses > 0 && stats.totalBooked > 0 
        ? Math.round((stats.totalAttendance / stats.totalBooked) * 100) 
        : 0
      return {
        slot,
        classes: stats.classes,
        avgAttendance: stats.pastClasses > 0 ? Math.round(stats.totalAttendance / stats.pastClasses) : 0,
        rate,
      }
    })
    .filter(s => s.classes > 0)
    .sort((a, b) => {
      // Sort by hour - parse the time slot properly
      const parseHour = (slot: string) => {
        const match = slot.match(/(\d+):\d+\s*(AM|PM)/i)
        if (!match) return 0
        let hour = parseInt(match[1])
        const isPM = match[2].toUpperCase() === 'PM'
        if (isPM && hour !== 12) hour += 12
        if (!isPM && hour === 12) hour = 0
        return hour // Sort by hour only
      }
      return parseHour(a.slot) - parseHour(b.slot)
    })
}

async function getClassPerformance(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rangeStart: Date
) {
  // Get classes scheduled in the range
  const { data: classes } = await supabase
    .from(TABLES.CLASSES)
    .select('id, title, instructor_name, capacity')
    .gte('scheduled_at', rangeStart.toISOString())
  
  const classIds = (classes || []).map(c => c.id)
  
  // Get bookings for those classes
  let bookings: Array<{ class_id: string; status: string }> = []
  if (classIds.length > 0) {
    const { data: bookingsData } = await supabase
      .from(TABLES.BOOKINGS)
      .select('class_id, status')
      .in('class_id', classIds)
    
    bookings = bookingsData || []
  }
  
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
  // Get classes scheduled in the range
  const { data: classes } = await supabase
    .from(TABLES.CLASSES)
    .select('id')
    .gte('scheduled_at', rangeStart.toISOString())
  
  const classIds = (classes || []).map(c => c.id)
  
  // Get all bookings for those classes (only for customers, not staff)
  let allBookings: Array<{ user_id: string; status: string; booked_at: string }> = []
  if (classIds.length > 0) {
    const { data: bookingsData } = await supabase
      .from(TABLES.BOOKINGS)
      .select('user_id, status, booked_at')
      .in('class_id', classIds)
    
    allBookings = bookingsData || []
  }
  
  // Get user IDs from bookings to filter for customers only
  const userIds = [...new Set((allBookings || []).map(b => b.user_id).filter(Boolean))]
  
  // Fetch user profiles to filter for customers only (exclude staff)
  let customerUserIds: string[] = []
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from(TABLES.USER_PROFILES)
      .select('id')
      .in('id', userIds)
      .eq('role', 'user')
    
    customerUserIds = (profiles || []).map(p => p.id)
  }
  
  // Filter bookings to only include customers
  const customerBookings = (allBookings || []).filter(b => customerUserIds.includes(b.user_id))
  
  // Group by user - count stats only for the selected period
  const userStats: Record<string, { noShows: number; totalBookings: number; lastNoShow: string }> = {}
  
  for (const booking of customerBookings) {
    const userId = booking.user_id
    if (!userId) continue
    
    if (!userStats[userId]) {
      userStats[userId] = { noShows: 0, totalBookings: 0, lastNoShow: '' }
    }
    
    // Count all bookings for this user in the period
    userStats[userId].totalBookings++
    
    // Count no-shows
    if (booking.status === 'no-show') {
      userStats[userId].noShows++
      if (!userStats[userId].lastNoShow || new Date(booking.booked_at) > new Date(userStats[userId].lastNoShow)) {
        userStats[userId].lastNoShow = booking.booked_at
      }
    }
  }
  
  // Filter users who have at least 1 no-show in the period and sort by no-show rate
  const usersWithNoShows = Object.entries(userStats)
    .filter(([, stats]) => stats.noShows > 0) // At least 1 no-show in the period
    .sort((a, b) => {
      // Sort by no-show rate (descending), then by number of no-shows
      const rateA = a[1].totalBookings > 0 ? (a[1].noShows / a[1].totalBookings) : 0
      const rateB = b[1].totalBookings > 0 ? (b[1].noShows / b[1].totalBookings) : 0
      if (rateB !== rateA) return rateB - rateA
      return b[1].noShows - a[1].noShows
    })
    .slice(0, 10) // Show top 10
    .map(([userId]) => userId)
  
  if (usersWithNoShows.length === 0) {
    return []
  }
  
  // Fetch user profiles (only customers, not staff)
  const { data: profiles } = await supabase
    .from(TABLES.USER_PROFILES)
    .select('id, name, email')
    .in('id', usersWithNoShows)
    .eq('role', 'user')
  
  const profileMap: Record<string, { name: string; email: string }> = {}
  for (const p of profiles || []) {
    profileMap[p.id] = { name: p.name, email: p.email }
  }
  
  // Return users with their stats for the selected period
  return usersWithNoShows
    .filter(userId => profileMap[userId])
    .map(userId => {
    const stats = userStats[userId]
    return {
      name: profileMap[userId]?.name || 'Unknown',
      email: profileMap[userId]?.email || 'unknown@email.com',
      noShows: stats.noShows,
      totalBookings: stats.totalBookings,
      rate: stats.totalBookings > 0 ? Math.round((stats.noShows / stats.totalBookings) * 100) : 0,
      lastNoShow: stats.lastNoShow ? stats.lastNoShow.split('T')[0] : '',
    }
  })
}

async function getMonthlyTrends(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  range: string,
  rangeStart: Date,
  now: Date
) {
  const trends = []
  
  // Determine which months to show based on range
  let monthsToShow: Array<{ month: number; year: number }> = []
  
  if (range === 'week') {
    // For week, show daily breakdown for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      if (date >= rangeStart) {
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
        
        // Get classes scheduled on this day
        const { data: classes } = await supabase
          .from(TABLES.CLASSES)
          .select('id')
          .gte('scheduled_at', dayStart.toISOString())
          .lte('scheduled_at', dayEnd.toISOString())
        
        const classIds = (classes || []).map(c => c.id)
        
        // Get bookings for those classes
        let attended = 0
        let noShows = 0
        let cancelled = 0
        
        if (classIds.length > 0) {
          const { data: bookings } = await supabase
            .from(TABLES.BOOKINGS)
            .select('status')
            .in('class_id', classIds)
          
          attended = (bookings || []).filter(b => b.status === 'attended').length
          noShows = (bookings || []).filter(b => b.status === 'no-show').length
          cancelled = (bookings || []).filter(b => ['cancelled', 'cancelled-late'].includes(b.status)).length
        }
        
        const total = attended + noShows + cancelled
        const rate = total > 0 ? Math.round((attended / total) * 100) : 0
        
        const dayName = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        trends.push({
          month: dayName,
          year: date.getFullYear(),
          attendance: attended,
          noShows,
          cancellations: cancelled,
          rate,
        })
      }
    }
    return trends
  } else if (range === 'quarter') {
    // For quarter, show the 3 months in the quarter
    const quarterStart = Math.floor(now.getMonth() / 3) * 3
    for (let i = 0; i < 3; i++) {
      const monthIndex = quarterStart + i
      const year = now.getFullYear()
      monthsToShow.push({ month: monthIndex, year })
    }
  } else if (range === 'year') {
    // For year, show all 12 months from January to December
    for (let i = 0; i < 12; i++) {
      monthsToShow.push({ month: i, year: now.getFullYear() })
    }
  } else {
    // For month, show last 7 months for context (including current month)
    // Calculate months going back from current month, handling year wrapping
    for (let i = 6; i >= 0; i--) {
      const targetMonth = now.getMonth() - i
      let year = now.getFullYear()
      let month = targetMonth
      
      // Handle year wrapping for negative months
      if (targetMonth < 0) {
        month = 12 + targetMonth
        year = year - 1
      }
      
      monthsToShow.push({ month, year })
    }
  }
  
  for (const { month, year } of monthsToShow) {
    const date = new Date(year, month, 1)
    const nextMonth = new Date(year, month + 1, 1)
    const monthEnd = nextMonth > now ? now : nextMonth
    
    // Skip future months
    if (date > now) {
      continue
    }
    
    // Only include data if it's within the selected range
    if (date < rangeStart && nextMonth <= rangeStart) {
      // Skip months completely before the range
      continue
    }
    
    const monthName = date.toLocaleDateString('en-US', { month: 'short' })
    const actualYear = date.getFullYear() // Get the actual year from the date object
    
    // Calculate the actual date range for this month within the selected range
    const monthStartDate = date >= rangeStart ? date : rangeStart
    const monthEndDate = monthEnd
    
    // First, get classes scheduled in this month
    const { data: classes } = await supabase
      .from(TABLES.CLASSES)
      .select('id')
      .gte('scheduled_at', monthStartDate.toISOString())
      .lt('scheduled_at', monthEndDate.toISOString())
    
    const classIds = (classes || []).map(c => c.id)
    
    // Then get bookings for those classes (count by class scheduled date, not booking date)
    let attended = 0
    let noShows = 0
    let cancelled = 0
    
    if (classIds.length > 0) {
      const { data: bookings } = await supabase
        .from(TABLES.BOOKINGS)
        .select('status')
        .in('class_id', classIds)
      
      attended = (bookings || []).filter(b => b.status === 'attended').length
      noShows = (bookings || []).filter(b => b.status === 'no-show').length
      cancelled = (bookings || []).filter(b => ['cancelled', 'cancelled-late'].includes(b.status)).length
    }
    
    const total = attended + noShows + cancelled
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0
    
    trends.push({
      month: monthName,
      year: actualYear, // Use the actual year from the date
      attendance: attended,
      noShows,
      cancellations: cancelled,
      rate,
    })
  }
  
  // Sort trends by date (oldest first) - parse month name to date for proper sorting
  trends.sort((a, b) => {
    // Parse month name to get month index
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthIndexA = monthNames.indexOf(a.month)
    const monthIndexB = monthNames.indexOf(b.month)
    
    if (a.year !== b.year) {
      return a.year - b.year
    }
    return monthIndexA - monthIndexB
  })
  
  return trends
}
