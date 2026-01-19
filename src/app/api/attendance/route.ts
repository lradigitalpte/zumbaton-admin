// Attendance Overview API Route
// Get today's classes with bookings for check-in station

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'

// GET /api/attendance - Get today's classes with attendees
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    
    // Default to today
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Get classes for the date with room info
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select(`
        id,
        title,
        scheduled_at,
        duration_minutes,
        capacity,
        instructor_id,
        instructor_name,
        room_id,
        status,
        rooms (
          id,
          name
        )
      `)
      .gte('scheduled_at', startOfDay.toISOString())
      .lte('scheduled_at', endOfDay.toISOString())
      .in('status', ['scheduled', 'in-progress', 'completed'])
      .order('scheduled_at', { ascending: true })

    if (classesError) {
      console.error('[Attendance API] Classes error:', classesError)
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch classes' }
      }, { status: 500 })
    }

    // Get bookings for these classes with user info and attendance status
    const classIds = (classes || []).map(c => c.id)
    
    if (classIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          date: targetDate.toISOString().split('T')[0],
          classes: [],
          stats: {
            totalClasses: 0,
            totalBookings: 0,
            checkedIn: 0,
            pending: 0,
            noShows: 0,
          }
        }
      })
    }

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        user_id,
        class_id,
        tokens_used,
        status,
        booked_at,
        attendances (
          id,
          checked_in_at,
          check_in_method
        )
      `)
      .in('class_id', classIds)
      .in('status', ['confirmed', 'attended', 'no-show'])
      .order('booked_at', { ascending: true })

    if (bookingsError) {
      console.error('[Attendance API] Bookings error:', bookingsError)
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch bookings' }
      }, { status: 500 })
    }

    // Get user IDs and fetch their profiles separately (no direct FK from bookings to user_profiles)
    const userIds = [...new Set((bookings || []).map(b => b.user_id))]
    
    let userProfiles: Record<string, { id: string; name: string; email: string; phone: string | null; avatar_url: string | null }> = {}
    let userTokens: Record<string, number> = {}
    
    if (userIds.length > 0) {
      // Fetch user profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name, email, phone, avatar_url')
        .in('id', userIds)
      
      for (const profile of profiles || []) {
        userProfiles[profile.id] = profile
      }
      
      // Fetch user token balances
      const { data: packages } = await supabase
        .from('user_packages')
        .select('user_id, tokens_remaining')
        .in('user_id', userIds)
        .eq('status', 'active')
        .gt('tokens_remaining', 0)

      // Sum tokens per user
      for (const pkg of packages || []) {
        userTokens[pkg.user_id] = (userTokens[pkg.user_id] || 0) + pkg.tokens_remaining
      }
    }

    // Map classes with their attendees
    const classesWithAttendees = (classes || []).map(cls => {
      const classBookings = (bookings || []).filter(b => b.class_id === cls.id)
      
      const attendees = classBookings.map(booking => {
        const profile = userProfiles[booking.user_id]
        const attendance = Array.isArray(booking.attendances) ? booking.attendances[0] : booking.attendances
        
        // Map booking status to UI status
        let uiStatus: 'pending' | 'checked-in' | 'no-show' = 'pending'
        if (booking.status === 'attended') uiStatus = 'checked-in'
        else if (booking.status === 'no-show') uiStatus = 'no-show'
        
        return {
          id: booking.user_id,
          name: profile?.name || 'Unknown',
          email: profile?.email || 'unknown@email.com',
          phone: profile?.phone || null,
          avatarUrl: profile?.avatar_url || null,
          bookingId: booking.id,
          status: uiStatus,
          checkedInAt: attendance?.checked_in_at 
            ? new Date(attendance.checked_in_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
            : null,
          tokenBalance: userTokens[booking.user_id] || 0,
          tokensUsed: booking.tokens_used,
        }
      })

      const scheduledAt = new Date(cls.scheduled_at)
      const endTime = new Date(scheduledAt.getTime() + (cls.duration_minutes || 60) * 60 * 1000)
      
      // Handle rooms - could be array or single object
      const roomsData = cls.rooms as { id: string; name: string }[] | { id: string; name: string } | null
      const roomName = Array.isArray(roomsData) ? roomsData[0]?.name : roomsData?.name
      
      return {
        id: cls.id,
        className: cls.title,
        instructor: cls.instructor_name || 'TBD',
        instructorId: cls.instructor_id,
        time: scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        endTime: endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        capacity: cls.capacity,
        room: roomName || 'TBD',
        roomId: cls.room_id,
        status: cls.status,
        attendees,
      }
    })

    // Calculate stats
    const allAttendees = classesWithAttendees.flatMap(c => c.attendees)
    const stats = {
      totalClasses: classesWithAttendees.length,
      totalBookings: allAttendees.length,
      checkedIn: allAttendees.filter(a => a.status === 'checked-in').length,
      pending: allAttendees.filter(a => a.status === 'pending').length,
      noShows: allAttendees.filter(a => a.status === 'no-show').length,
    }

    return NextResponse.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        classes: classesWithAttendees,
        stats,
      }
    })
  } catch (error) {
    console.error('[Attendance API] Error:', error)
    return NextResponse.json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' }
    }, { status: 500 })
  }
}
