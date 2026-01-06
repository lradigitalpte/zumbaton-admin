import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

/**
 * GET /api/tutor/stats
 * Get instructor's detailed statistics
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

    if (!['instructor', 'super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Instructor access required' } },
        { status: 403 }
      )
    }

    const supabase = getSupabaseAdminClient()
    const instructorId = user.id
    const now = new Date()

    // Get instructor's name to check for multiple instructor classes
    const { data: instructorProfile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', instructorId)
      .single()
    
    const instructorName = instructorProfile?.name || ''

    // Get all classes for this instructor - include classes where instructor is primary OR in multiple instructors list
    const { data: allClasses } = await supabase
      .from('classes')
      .select('id, class_type, scheduled_at, capacity, status')
      .or(`instructor_id.eq.${instructorId},instructor_name.ilike.%${instructorName}%`)

    const classIds = (allClasses || []).map(c => c.id)
    const totalClasses = classIds.length
    const completedClasses = (allClasses || []).filter(c => c.status === 'completed').length

    // Get all bookings for these classes
    let totalStudents = 0
    let totalAttendance = 0
    let totalNoShows = 0
    const uniqueStudents = new Set<string>()

    if (classIds.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('user_id, status')
        .in('class_id', classIds)

      for (const booking of bookings || []) {
        uniqueStudents.add(booking.user_id)
        if (['confirmed', 'attended'].includes(booking.status)) {
          totalStudents++
        }
        if (booking.status === 'attended') {
          totalAttendance++
        }
        if (booking.status === 'no-show') {
          totalNoShows++
        }
      }
    }

    // Calculate this month's stats
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const monthClasses = (allClasses || []).filter(c => {
      const classDate = new Date(c.scheduled_at)
      return classDate >= startOfMonth && classDate <= endOfMonth
    })
    const monthClassIds = monthClasses.map(c => c.id)

    let monthStudents = 0
    let monthAttendance = 0
    const monthUniqueStudents = new Set<string>()

    if (monthClassIds.length > 0) {
      const { data: monthBookings } = await supabase
        .from('bookings')
        .select('user_id, status')
        .in('class_id', monthClassIds)
        .in('status', ['confirmed', 'attended'])

      for (const booking of monthBookings || []) {
        monthUniqueStudents.add(booking.user_id)
        monthStudents++
        if (booking.status === 'attended') {
          monthAttendance++
        }
      }
    }

    // Calculate previous month's stats for comparison
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    const lastMonthClasses = (allClasses || []).filter(c => {
      const classDate = new Date(c.scheduled_at)
      return classDate >= startOfLastMonth && classDate <= endOfLastMonth
    })
    const lastMonthClassIds = lastMonthClasses.map(c => c.id)

    let lastMonthStudents = 0
    let lastMonthAttendance = 0
    const lastMonthUniqueStudents = new Set<string>()

    if (lastMonthClassIds.length > 0) {
      const { data: lastMonthBookings } = await supabase
        .from('bookings')
        .select('user_id, status')
        .in('class_id', lastMonthClassIds)
        .in('status', ['confirmed', 'attended'])

      for (const booking of lastMonthBookings || []) {
        lastMonthUniqueStudents.add(booking.user_id)
        lastMonthStudents++
        if (booking.status === 'attended') {
          lastMonthAttendance++
        }
      }
    }

    // Calculate percentage changes
    const classesChange = lastMonthClasses.length > 0
      ? Math.round(((monthClasses.length - lastMonthClasses.length) / lastMonthClasses.length) * 100)
      : monthClasses.length > 0 ? 100 : 0

    const studentsChange = lastMonthUniqueStudents.size > 0
      ? Math.round(((monthUniqueStudents.size - lastMonthUniqueStudents.size) / lastMonthUniqueStudents.size) * 100)
      : monthUniqueStudents.size > 0 ? 100 : 0

    const lastMonthAttendanceRate = lastMonthStudents > 0
      ? Math.round((lastMonthAttendance / lastMonthStudents) * 100)
      : 0

    const attendanceRateChange = lastMonthAttendanceRate > 0
      ? Math.round(((monthStudents > 0 ? Math.round((monthAttendance / monthStudents) * 100) : 0) - lastMonthAttendanceRate))
      : (monthStudents > 0 ? Math.round((monthAttendance / monthStudents) * 100) : 0) > 0 ? 100 : 0

    // Calculate classes by type with detailed stats
    const classesByType: Record<string, { classes: number; students: number; attendance: number; attendanceRate: number }> = {}
    const classTypeClassIds: Record<string, string[]> = {}
    
    for (const cls of allClasses || []) {
      if (!classesByType[cls.class_type]) {
        classesByType[cls.class_type] = { classes: 0, students: 0, attendance: 0, attendanceRate: 0 }
        classTypeClassIds[cls.class_type] = []
      }
      classesByType[cls.class_type].classes++
      classTypeClassIds[cls.class_type].push(cls.id)
    }

    // Get booking stats per class type
    for (const [type, classIds] of Object.entries(classTypeClassIds)) {
      if (classIds.length > 0) {
        const { data: typeBookings } = await supabase
          .from('bookings')
          .select('status')
          .in('class_id', classIds)
          .in('status', ['confirmed', 'attended'])

        const typeStudents = (typeBookings || []).length
        const typeAttendance = (typeBookings || []).filter(b => b.status === 'attended').length
        const typeAttendanceRate = typeStudents > 0 
          ? Math.round((typeAttendance / typeStudents) * 100) 
          : 0

        classesByType[type].students = typeStudents
        classesByType[type].attendance = typeAttendance
        classesByType[type].attendanceRate = typeAttendanceRate
      }
    }

    // Calculate average class size
    const avgClassSize = totalClasses > 0 
      ? Math.round(totalStudents / totalClasses) 
      : 0

    // Calculate attendance rate
    const attendanceRate = totalStudents > 0 
      ? Math.round((totalAttendance / totalStudents) * 100) 
      : 0

    // Calculate capacity utilization
    const totalCapacity = (allClasses || []).reduce((sum, c) => sum + c.capacity, 0)
    const capacityUtilization = totalCapacity > 0
      ? Math.round((totalStudents / totalCapacity) * 100)
      : 0

    // Get top students (students with most bookings)
    const topStudents: Array<{ name: string; classes: number; attendance: number }> = []
    if (classIds.length > 0) {
      const { data: studentBookings } = await supabase
        .from('bookings')
        .select('user_id, status')
        .in('class_id', classIds)
        .in('status', ['confirmed', 'attended'])

      // Count bookings per student
      const studentStats: Record<string, { total: number; attended: number }> = {}
      for (const booking of studentBookings || []) {
        const userId = booking.user_id
        if (!studentStats[userId]) {
          studentStats[userId] = { total: 0, attended: 0 }
        }
        studentStats[userId].total++
        if (booking.status === 'attended') {
          studentStats[userId].attended++
        }
      }

      // Get user profiles for student names
      const userIds = Object.keys(studentStats)
      let userProfiles: Record<string, string> = {}
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, name')
          .in('id', userIds)

        if (profiles) {
          profiles.forEach(profile => {
            userProfiles[profile.id] = profile.name || 'Unknown'
          })
        }
      }

      const sortedStudents = Object.entries(studentStats)
        .map(([userId, stats]) => ({
          name: userProfiles[userId] || 'Unknown',
          classes: stats.total,
          attendance: stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0
        }))
        .sort((a, b) => b.classes - a.classes)
        .slice(0, 5)

      topStudents.push(...sortedStudents)
    }

    // Calculate 6-month monthly performance
    const monthlyPerformance: Array<{ month: string; classes: number; students: number; attendance: number }> = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)
      
      const monthClasses = (allClasses || []).filter(c => {
        const classDate = new Date(c.scheduled_at)
        return classDate >= monthStart && classDate <= monthEnd
      })
      const monthClassIds = monthClasses.map(c => c.id)

      let monthStudents = 0
      let monthAttendance = 0

      if (monthClassIds.length > 0) {
        const { data: monthBookings } = await supabase
          .from('bookings')
          .select('status')
          .in('class_id', monthClassIds)
          .in('status', ['confirmed', 'attended'])

        monthStudents = (monthBookings || []).length
        monthAttendance = (monthBookings || []).filter(b => b.status === 'attended').length
      }

      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' })
      monthlyPerformance.push({
        month: monthName,
        classes: monthClasses.length,
        students: monthStudents,
        attendance: monthStudents > 0 ? Math.round((monthAttendance / monthStudents) * 100) : 0
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalClassesTaught: completedClasses,
          totalScheduled: totalClasses,
          uniqueStudents: uniqueStudents.size,
          totalStudentBookings: totalStudents,
          attendanceRate,
          noShowRate: totalStudents > 0 ? Math.round((totalNoShows / totalStudents) * 100) : 0,
          avgClassSize,
          capacityUtilization,
        },
        thisMonth: {
          classes: monthClasses.length,
          students: monthStudents,
          attendance: monthAttendance,
          attendanceRate: monthStudents > 0 
            ? Math.round((monthAttendance / monthStudents) * 100) 
            : 0,
        },
        changes: {
          classesChange,
          studentsChange,
          attendanceRateChange,
        },
        byClassType: classesByType,
        topStudents,
        monthlyPerformance,
      }
    })
  } catch (error) {
    console.error('[Tutor API] Stats error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
