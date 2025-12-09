import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

/**
 * GET /api/tutor/classes/[classId]
 * Get specific class details with enrolled students
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
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

    const { classId } = await params
    const supabase = getSupabaseAdminClient()

    // Get class details
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select(`
        id,
        title,
        description,
        class_type,
        level,
        instructor_id,
        instructor_name,
        scheduled_at,
        duration_minutes,
        capacity,
        token_cost,
        location,
        status,
        created_at
      `)
      .eq('id', classId)
      .single()

    if (classError || !classData) {
      return NextResponse.json(
        { success: false, error: { message: 'Class not found' } },
        { status: 404 }
      )
    }

    // Verify instructor owns this class (or is admin)
    if (classData.instructor_id !== user.id && !['super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - This is not your class' } },
        { status: 403 }
      )
    }

    // Get enrolled students with their booking status
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        user_id,
        status,
        booked_at,
        user_profiles!bookings_user_id_fkey (
          id,
          name,
          email,
          avatar_url,
          phone
        )
      `)
      .eq('class_id', classId)
      .in('status', ['confirmed', 'attended', 'no-show'])
      .order('booked_at', { ascending: true })

    if (bookingsError) {
      console.error('[Tutor API] Error fetching bookings:', bookingsError)
    }

    // Format students list
    const students = (bookings || []).map(b => ({
      bookingId: b.id,
      status: b.status,
      bookedAt: b.booked_at,
      user: b.user_profiles,
    }))

    // Get attendance stats
    const confirmedCount = students.filter(s => s.status === 'confirmed').length
    const attendedCount = students.filter(s => s.status === 'attended').length
    const noShowCount = students.filter(s => s.status === 'no-show').length

    return NextResponse.json({
      success: true,
      data: {
        class: classData,
        students,
        stats: {
          enrolled: students.length,
          confirmed: confirmedCount,
          attended: attendedCount,
          noShow: noShowCount,
          spotsLeft: classData.capacity - students.length,
        },
      }
    })
  } catch (error) {
    console.error('[Tutor API] Class detail error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
