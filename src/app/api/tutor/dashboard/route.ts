import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

/**
 * GET /api/tutor/dashboard
 * Get instructor's dashboard data - their classes, students, stats
 * Optimized: runs queries in parallel where possible
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    // Only instructors (and admins for testing) can access
    if (!['instructor', 'super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Instructor access required' } },
        { status: 403 }
      )
    }

    const supabase = getSupabaseAdminClient()
    const instructorId = user.id
    const now = new Date()
    
    // Calculate date ranges
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)
    
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    // Run all initial queries in PARALLEL
    const [
      profileResult,
      weekClassesResult,
      todayClassesResult,
      upcomingCountResult,
      nextClassResult,
      allClassIdsResult,
    ] = await Promise.all([
      // Get instructor profile
      supabase
        .from('user_profiles')
        .select('id, name, email, avatar_url')
        .eq('id', instructorId)
        .single(),
      
      // Get this week's classes
      supabase
        .from('classes')
        .select('id, title, class_type, scheduled_at, duration_minutes, capacity, location, status')
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', startOfWeek.toISOString())
        .lt('scheduled_at', endOfWeek.toISOString())
        .order('scheduled_at', { ascending: true }),
      
      // Get today's classes
      supabase
        .from('classes')
        .select('id, title, class_type, scheduled_at, duration_minutes, capacity, location, status')
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', startOfDay.toISOString())
        .lt('scheduled_at', endOfDay.toISOString())
        .order('scheduled_at', { ascending: true }),
      
      // Get upcoming classes count
      supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', now.toISOString())
        .eq('status', 'scheduled'),
      
      // Get next class
      supabase
        .from('classes')
        .select('scheduled_at')
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', now.toISOString())
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single(),
      
      // Get all class IDs for this instructor (for booking stats)
      supabase
        .from('classes')
        .select('id, class_type')
        .eq('instructor_id', instructorId),
    ])

    const profile = profileResult.data
    const weekClasses = weekClassesResult.data || []
    const todayClasses = todayClassesResult.data || []
    const upcomingCount = upcomingCountResult.count || 0
    const nextClass = nextClassResult.data
    const allClasses = allClassIdsResult.data || []

    // Get specialties from all classes
    const specialties = [...new Set(allClasses.map(c => c.class_type))]
    const allClassIds = allClasses.map(c => c.id)
    const todayClassIds = todayClasses.map(c => c.id)

    // Calculate next class time
    let nextClassIn = null
    if (nextClass) {
      const nextTime = new Date(nextClass.scheduled_at)
      const diffMs = nextTime.getTime() - now.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      nextClassIn = { hours, mins, total: diffMins }
    }

    // Get booking data in parallel (only if we have classes)
    let bookingCounts: Record<string, { confirmed: number; attended: number }> = {}
    let uniqueStudents = 0
    let totalAttendance = 0
    let totalBooked = 0

    if (allClassIds.length > 0) {
      // Query bookings for today's classes and all classes in parallel
      const bookingQueries = []
      
      if (todayClassIds.length > 0) {
        bookingQueries.push(
          supabase
            .from('bookings')
            .select('class_id, status')
            .in('class_id', todayClassIds)
            .in('status', ['confirmed', 'attended'])
        )
      } else {
        bookingQueries.push(Promise.resolve({ data: [] }))
      }
      
      bookingQueries.push(
        supabase
          .from('bookings')
          .select('user_id, status')
          .in('class_id', allClassIds)
      )

      const [todayBookingsResult, allBookingsResult] = await Promise.all(bookingQueries)

      // Process today's booking counts
      const todayBookings = todayBookingsResult.data || []
      bookingCounts = todayBookings.reduce((acc: Record<string, { confirmed: number; attended: number }>, b: { class_id: string; status: string }) => {
        if (!acc[b.class_id]) {
          acc[b.class_id] = { confirmed: 0, attended: 0 }
        }
        if (b.status === 'confirmed') acc[b.class_id].confirmed++
        if (b.status === 'attended') acc[b.class_id].attended++
        return acc
      }, {})

      // Process all bookings for stats
      const allBookings = allBookingsResult.data || []
      const uniqueUserIds = new Set(allBookings.map((b: { user_id: string }) => b.user_id))
      uniqueStudents = uniqueUserIds.size
      
      totalBooked = allBookings.filter((b: { status: string }) => 
        ['confirmed', 'attended'].includes(b.status)
      ).length
      totalAttendance = allBookings.filter((b: { status: string }) => 
        b.status === 'attended'
      ).length
    }

    // Format today's classes with booking info
    const todayClassesWithBookings = todayClasses.map(cls => ({
      ...cls,
      bookedCount: (bookingCounts[cls.id]?.confirmed || 0) + (bookingCounts[cls.id]?.attended || 0),
      checkedInCount: bookingCounts[cls.id]?.attended || 0,
    }))

    // Calculate attendance rate
    const attendanceRate = totalBooked > 0 
      ? Math.round((totalAttendance / totalBooked) * 100) 
      : 0

    return NextResponse.json({
      success: true,
      data: {
        profile,
        stats: {
          thisWeekClasses: weekClasses.length,
          totalStudents: uniqueStudents,
          attendanceRate,
          upcomingClasses: upcomingCount,
          totalClassesTaught: allClassIds.length,
        },
        nextClassIn,
        todayClasses: todayClassesWithBookings,
        weekSchedule: weekClasses,
        specialties,
      }
    })
  } catch (error) {
    console.error('[Tutor API] Dashboard error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
