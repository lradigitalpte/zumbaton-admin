import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

/**
 * GET /api/tutor/students
 * Get all unique students who have booked instructor's classes
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
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get all class IDs for this instructor
    const { data: classes } = await supabase
      .from('classes')
      .select('id')
      .eq('instructor_id', instructorId)

    const classIds = (classes || []).map(c => c.id)

    if (classIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          students: [],
          meta: { total: 0, limit, offset, hasMore: false },
        }
      })
    }

    // Get all bookings for instructor's classes
    const { data: bookings } = await supabase
      .from('bookings')
      .select('user_id, status, class_id')
      .in('class_id', classIds)

    // Get unique user IDs
    const userStats: Record<string, { 
      classesBooked: number
      classesAttended: number
      noShows: number
    }> = {}

    for (const booking of bookings || []) {
      if (!userStats[booking.user_id]) {
        userStats[booking.user_id] = {
          classesBooked: 0,
          classesAttended: 0,
          noShows: 0,
        }
      }
      if (['confirmed', 'attended'].includes(booking.status)) {
        userStats[booking.user_id].classesBooked++
      }
      if (booking.status === 'attended') {
        userStats[booking.user_id].classesAttended++
      }
      if (booking.status === 'no-show') {
        userStats[booking.user_id].noShows++
      }
    }

    const userIds = Object.keys(userStats)

    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          students: [],
          meta: { total: 0, limit, offset, hasMore: false },
        }
      })
    }

    // Get user profiles
    let profileQuery = supabase
      .from('user_profiles')
      .select('id, name, email, avatar_url, phone, created_at', { count: 'exact' })
      .in('id', userIds)
      .order('name', { ascending: true })

    if (search) {
      profileQuery = profileQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    profileQuery = profileQuery.range(offset, offset + limit - 1)

    const { data: profiles, count } = await profileQuery

    // Combine profiles with stats
    const students = (profiles || []).map(profile => ({
      ...profile,
      stats: userStats[profile.id] || {
        classesBooked: 0,
        classesAttended: 0,
        noShows: 0,
      },
      attendanceRate: userStats[profile.id]?.classesBooked > 0
        ? Math.round((userStats[profile.id].classesAttended / userStats[profile.id].classesBooked) * 100)
        : 0,
    }))

    return NextResponse.json({
      success: true,
      data: {
        students,
        meta: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + (profiles?.length || 0)) < (count || 0),
        },
      }
    })
  } catch (error) {
    console.error('[Tutor API] Students error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
