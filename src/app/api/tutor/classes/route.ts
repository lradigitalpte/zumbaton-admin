import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

/**
 * GET /api/tutor/classes
 * Get instructor's classes with filters
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
    
    // Parse query params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'upcoming', 'past', 'today', 'all'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    // First, get instructor's name to check for multiple instructor classes
    const { data: instructorProfile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', instructorId)
      .single()
    
    const instructorName = instructorProfile?.name || ''

    const now = new Date()
    const ascending = status === 'upcoming' || status === 'today'
    let query = supabase
      .from('classes')
      .select(`
        id,
        title,
        description,
        class_type,
        level,
        scheduled_at,
        duration_minutes,
        capacity,
        token_cost,
        location,
        room_id,
        rooms (
          id,
          name
        ),
        status,
        created_at,
        instructor_name,
        recurrence_type,
        recurrence_pattern,
        parent_class_id
      `, { count: 'exact' })
      // Include classes where instructor is primary OR in multiple instructors list
      .or(`instructor_id.eq.${instructorId},instructor_name.ilike.%${instructorName}%`)
      .order('scheduled_at', { ascending })

    if (startDate) {
      query = query.gte('scheduled_at', startDate)
    }

    if (endDate) {
      query = query.lte('scheduled_at', endDate)
    }

    // Apply status filter
    if (status === 'upcoming') {
      query = query.gte('scheduled_at', now.toISOString())
        .in('status', ['scheduled', 'in-progress'])
    } else if (status === 'past') {
      query = query.lt('scheduled_at', now.toISOString())
    } else if (status === 'today') {
      const startOfDay = new Date(now)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(now)
      endOfDay.setHours(23, 59, 59, 999)
      query = query
        .gte('scheduled_at', startOfDay.toISOString())
        .lt('scheduled_at', endOfDay.toISOString())
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: classes, error, count } = await query

    if (error) {
      console.error('[Tutor API] Error fetching classes:', error)
      return NextResponse.json(
        { success: false, error: { message: 'Failed to fetch classes' } },
        { status: 500 }
      )
    }

    // Get booking counts for each class
    const classIds = (classes || []).map(c => c.id)
    let bookingData: Record<string, { total: number; attended: number }> = {}

    if (classIds.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('class_id, status')
        .in('class_id', classIds)

      bookingData = (bookings || []).reduce((acc, b) => {
        if (!acc[b.class_id]) {
          acc[b.class_id] = { total: 0, attended: 0 }
        }
        if (['confirmed', 'attended'].includes(b.status)) {
          acc[b.class_id].total++
        }
        if (b.status === 'attended') {
          acc[b.class_id].attended++
        }
        return acc
      }, {} as Record<string, { total: number; attended: number }>)
    }

    // Combine classes with booking data and format room name
    const classesWithBookings = (classes || []).map(cls => {
      // Get room name from joined rooms table or fall back to location field
      let roomName = null;
      
      // Handle rooms join - can be array, object, or null
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
      
      return {
        ...cls,
        room_name: roomName,
        bookedCount: bookingData[cls.id]?.total || 0,
        attendedCount: bookingData[cls.id]?.attended || 0,
      };
    })

    // Group recurring and course classes
    const groupedClasses = groupRecurringAndCourseClasses(classesWithBookings, bookingData, ascending)

    return NextResponse.json({
      success: true,
      data: {
        classes: groupedClasses,
        meta: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + (classes?.length || 0)) < (count || 0),
        },
      }
    })
  } catch (error) {
    console.error('[Tutor API] Classes error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * Group recurring and course classes - show parent cards for series
 */
function groupRecurringAndCourseClasses(
  classes: any[],
  bookingData: Record<string, { total: number; attended: number }>,
  ascending: boolean
): any[] {
  const singleClasses: any[] = []
  const recurringParents: any[] = []
  const courseParents: any[] = []

  // Separate parent classes and child instances
  const parentClasses: any[] = []
  const childInstances: any[] = []

  classes.forEach((classItem: any) => {
    const isRecurringType = classItem.recurrence_type === 'recurring' || classItem.recurrence_type === 'course'
    const isOccurrenceClass = /-\s*\d{1,2}\/\d{1,2}\/\d{4}$/.test(classItem.title)
    
    // Parent classes: have recurrence_type but no parent_class_id and no date suffix
    if (isRecurringType && !classItem.parent_class_id && !isOccurrenceClass) {
      parentClasses.push(classItem)
    } 
    // Child instances: have parent_class_id or date suffix
    else if (classItem.parent_class_id || isOccurrenceClass) {
      childInstances.push(classItem)
    }
    // Single classes: show all
    else {
      parentClasses.push(classItem)
    }
  })

  // Group child instances by parent_class_id
  const childrenByParent = new Map<string, any[]>()
  childInstances.forEach((child) => {
    const parentId = child.parent_class_id
    if (parentId) {
      if (!childrenByParent.has(parentId)) {
        childrenByParent.set(parentId, [])
      }
      childrenByParent.get(parentId)!.push(child)
    }
  })

  // Process each parent class
  parentClasses.forEach((parent) => {
    const bookedCount = bookingData[parent.id]?.total || 0
    const attendedCount = bookingData[parent.id]?.attended || 0
    
    const isRecurring = parent.recurrence_type === 'recurring'
    const isCourse = parent.recurrence_type === 'course'
    
    if (isRecurring || isCourse) {
      const instances = childrenByParent.get(parent.id) || []
      
      if (instances.length > 0) {
        // Sort instances by date
        const sorted = [...instances].sort((a, b) => 
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        )
        
        // Find next upcoming session (or first session if all are past)
        const now = new Date()
        const nextUpcoming = sorted.find(s => new Date(s.scheduled_at) > now) || sorted[sorted.length - 1] || sorted[0]
        
        // Calculate total enrolled/attended across all sessions
        const totalEnrolled = sorted.reduce((sum, s) => sum + (bookingData[s.id]?.total || 0), 0)
        const totalAttended = sorted.reduce((sum, s) => sum + (bookingData[s.id]?.attended || 0), 0)
        const perSessionCapacity = parent.capacity
        
        // Get room name from next upcoming session or parent
        let roomName = null
        if (nextUpcoming.rooms) {
          if (Array.isArray(nextUpcoming.rooms) && nextUpcoming.rooms.length > 0) {
            roomName = nextUpcoming.rooms[0].name
          } else if (typeof nextUpcoming.rooms === 'object' && nextUpcoming.rooms.name) {
            roomName = nextUpcoming.rooms.name
          }
        }
        if (!roomName && nextUpcoming.location) {
          roomName = nextUpcoming.location
        }
        if (!roomName && parent.rooms) {
          if (Array.isArray(parent.rooms) && parent.rooms.length > 0) {
            roomName = parent.rooms[0].name
          } else if (typeof parent.rooms === 'object' && parent.rooms.name) {
            roomName = parent.rooms.name
          }
        }
        if (!roomName && parent.location) {
          roomName = parent.location
        }
        
        const parentCard = {
          ...parent,
          room_name: roomName,
          scheduled_at: nextUpcoming.scheduled_at,
          bookedCount: totalEnrolled,
          attendedCount: totalAttended,
          capacity: perSessionCapacity,
          _isParent: true,
          _childInstances: sorted,
          _totalSessions: sorted.length,
        }
        
        if (isCourse) {
          courseParents.push(parentCard)
        } else {
          recurringParents.push(parentCard)
        }
      } else {
        // No instances yet, show parent as-is
        const parentCard = {
          ...parent,
          _isParent: true,
          _childInstances: [],
          _totalSessions: 0,
        }
        if (isCourse) {
          courseParents.push(parentCard)
        } else {
          recurringParents.push(parentCard)
        }
      }
    } else {
      singleClasses.push(parent)
    }
  })

  // Return all classes sorted by date
  return [...singleClasses, ...recurringParents, ...courseParents].sort((a, b) => {
    const dateA = new Date(a.scheduled_at).getTime()
    const dateB = new Date(b.scheduled_at).getTime()
    return ascending ? (dateA - dateB) : (dateB - dateA)
  })
}


