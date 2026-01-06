import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

/**
 * GET /api/tutor/schedule
 * Get instructor's weekly/monthly schedule
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

    // Get instructor's name to check for multiple instructor classes
    const { data: instructorProfile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', instructorId)
      .single()
    
    const instructorName = instructorProfile?.name || ''

    // Parse query params
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'week' // 'week' or 'month'
    const dateParam = searchParams.get('date') // ISO date string

    const referenceDate = dateParam ? new Date(dateParam) : new Date()
    let startDate: Date
    let endDate: Date

    if (view === 'month') {
      startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
      endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999)
    } else {
      // Week view - start from Sunday
      startDate = new Date(referenceDate)
      startDate.setDate(referenceDate.getDate() - referenceDate.getDay())
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6)
      endDate.setHours(23, 59, 59, 999)
    }

    // Get classes in date range - include classes where instructor is primary OR in multiple instructors list
    const { data: classes, error } = await supabase
      .from('classes')
      .select(`
        id,
        title,
        class_type,
        scheduled_at,
        duration_minutes,
        capacity,
        location,
        room_id,
        rooms (
          id,
          name
        ),
        status
      `)
      .or(`instructor_id.eq.${instructorId},instructor_name.ilike.%${instructorName}%`)
      .gte('scheduled_at', startDate.toISOString())
      .lte('scheduled_at', endDate.toISOString())
      .order('scheduled_at', { ascending: true })

    if (error) {
      console.error('[Tutor API] Error fetching schedule:', error)
      return NextResponse.json(
        { success: false, error: { message: 'Failed to fetch schedule' } },
        { status: 500 }
      )
    }

    // Get booking counts
    const classIds = (classes || []).map(c => c.id)
    let bookingCounts: Record<string, number> = {}

    if (classIds.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('class_id')
        .in('class_id', classIds)
        .in('status', ['confirmed', 'attended'])

      bookingCounts = (bookings || []).reduce((acc, b) => {
        acc[b.class_id] = (acc[b.class_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }

    // Group classes by day
    const schedule: Record<string, Array<{
      id: string
      title: string
      classType: string
      time: string
      duration: number
      location: string | null
      status: string
      booked: number
      capacity: number
    }>> = {}

    for (const cls of classes || []) {
      const date = new Date(cls.scheduled_at)
      // Always use ISO date string (YYYY-MM-DD) for grouping, regardless of view
      const dayKey = date.toISOString().split('T')[0]

      if (!schedule[dayKey]) {
        schedule[dayKey] = []
      }

      // Get room name from joined rooms table or fall back to location
      // Handle rooms join - can be array, object, or null
      let roomName = null;
      if (cls.rooms) {
        if (Array.isArray(cls.rooms) && cls.rooms.length > 0) {
          roomName = (cls.rooms[0] as any).name;
        } else if (typeof cls.rooms === 'object' && !Array.isArray(cls.rooms) && (cls.rooms as any).name) {
          roomName = (cls.rooms as any).name;
        }
      }
      
      // Fall back to location field if no room name found
      if (!roomName && cls.location) {
        roomName = cls.location;
      }
      
      schedule[dayKey].push({
        id: cls.id,
        title: cls.title,
        classType: cls.class_type,
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        duration: cls.duration_minutes,
        location: roomName,
        status: cls.status,
        booked: bookingCounts[cls.id] || 0,
        capacity: cls.capacity,
      })
    }

    // Calculate totals
    const totalClasses = (classes || []).length
    const totalByType: Record<string, number> = {}
    for (const cls of classes || []) {
      totalByType[cls.class_type] = (totalByType[cls.class_type] || 0) + 1
    }

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          view,
        },
        summary: {
          totalClasses,
          byType: totalByType,
        },
      }
    })
  } catch (error) {
    console.error('[Tutor API] Schedule error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
