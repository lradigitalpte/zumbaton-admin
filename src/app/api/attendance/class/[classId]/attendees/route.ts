// Attendance Class Attendees API Route
// Get real-time attendees for a specific class

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { UuidSchema } from '@/api/schemas'

interface RouteParams {
  params: Promise<{ classId: string }>
}

// GET /api/attendance/class/[classId]/attendees - Get attendees for a class
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { classId } = await params
    
    // Validate UUID
    UuidSchema.parse(classId)

    const supabase = getSupabaseAdminClient()

    // Get class info
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, title, scheduled_at, instructor_name, capacity')
      .eq('id', classId)
      .single()

    if (classError || !classData) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Class not found' },
        },
        { status: 404 }
      )
    }

    // Get ALL bookings for this class
    const { data: allBookingsRaw, error: allBookingsError } = await supabase
      .from('bookings')
      .select('id, user_id, status, booked_at')
      .eq('class_id', classId)
      .order('booked_at', { ascending: true })

    // Log for debugging
    console.log('[Attendance API] Raw bookings count:', allBookingsRaw?.length || 0, 'Error:', allBookingsError?.message)
    if (allBookingsError) {
      console.error('[Attendance API] Bookings query error details:', allBookingsError)
    }

    // Filter out cancelled bookings for "expected" count (people expected to show up)
    // Expected = confirmed + waitlist + attended + no-show (exclude cancelled)
    const allBookings = (allBookingsRaw || []).filter(b => 
      !['cancelled', 'cancelled-late'].includes(b.status)
    )

    // Get bookings that are confirmed, attended, or no-show (for attendee list - only these can check in)
    const bookings = allBookings.filter(b => 
      ['confirmed', 'attended', 'no-show'].includes(b.status)
    )

    if (allBookingsError) {
      console.error('[Attendance API] Bookings error:', allBookingsError)
      // Return empty arrays instead of error - class might have no bookings yet
      return NextResponse.json({
        success: true,
        data: {
          class: {
            id: classData.id,
            name: classData.title,
            instructor: classData.instructor_name || 'Unknown Instructor',
            time: new Date(classData.scheduled_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            scheduledAt: classData.scheduled_at,
            enrolled: 0,
            capacity: classData.capacity,
          },
          attendees: [],
          checkedIn: 0,
          expected: 0,
        },
      })
    }

    // Get attendance records (only if there are bookings)
    let attendances: { booking_id: string; checked_in_at: string }[] = []
    if (bookings.length > 0) {
      const bookingIds = bookings.map(b => b.id)
      const { data: attendanceData } = await supabase
        .from('attendances')
        .select('booking_id, checked_in_at')
        .in('booking_id', bookingIds)
        .order('checked_in_at', { ascending: false })
      
      attendances = attendanceData || []
    }

    // Get user IDs from bookings (for checked-in attendees)
    const userIds = [...new Set(bookings.map(b => b.user_id))]

    // Fetch user profiles separately
    let userProfiles: Record<string, { id: string; name: string; email: string; avatar_url: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name, email, avatar_url')
        .in('id', userIds)

      if (profiles) {
        profiles.forEach(profile => {
          userProfiles[profile.id] = profile
        })
      }
    }

    // Create a map of booking_id to attendance
    const attendanceMap = new Map(
      attendances.map(a => [a.booking_id, a.checked_in_at])
    )

    // Format attendees (only those who have checked in)
    const attendees = bookings
      .filter(b => attendanceMap.has(b.id)) // Only show checked-in attendees
      .map(booking => {
        const user = userProfiles[booking.user_id]
        const checkedInAt = attendanceMap.get(booking.id)
        
        // Generate avatar initials
        const name = user?.name || 'Unknown'
        const initials = name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)

        return {
          id: booking.id,
          userId: booking.user_id,
          name: name,
          avatar: initials,
          checkedInAt: checkedInAt ? new Date(checkedInAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }) : '',
        }
      })
      .sort((a, b) => {
        // Sort by check-in time (most recent first)
        if (!a.checkedInAt) return 1
        if (!b.checkedInAt) return -1
        return b.checkedInAt.localeCompare(a.checkedInAt)
      })

    // Format class data
    const scheduledAt = new Date(classData.scheduled_at)
    const timeStr = scheduledAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })

    return NextResponse.json({
      success: true,
      data: {
        class: {
          id: classData.id,
          name: classData.title,
          instructor: classData.instructor_name || 'Unknown Instructor',
          time: timeStr,
            scheduledAt: classData.scheduled_at,
            enrolled: allBookings?.length || 0, // Total bookings (enrolled)
            capacity: classData.capacity,
          },
          attendees,
          checkedIn: attendees.length,
          expected: allBookings?.length || 0, // Total bookings (expected)
      },
    })
  } catch (error) {
    console.error('[Attendance API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    )
  }
}

