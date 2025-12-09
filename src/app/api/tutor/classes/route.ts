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

    const now = new Date()
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
        status,
        created_at
      `, { count: 'exact' })
      .eq('instructor_id', instructorId)
      .order('scheduled_at', { ascending: status !== 'past' })

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

    // Combine classes with booking data
    const classesWithBookings = (classes || []).map(cls => ({
      ...cls,
      bookedCount: bookingData[cls.id]?.total || 0,
      attendedCount: bookingData[cls.id]?.attended || 0,
    }))

    return NextResponse.json({
      success: true,
      data: {
        classes: classesWithBookings,
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
