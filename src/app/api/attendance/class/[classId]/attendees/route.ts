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

    // Get ALL bookings for this class (include guest_name for trial/guest bookings)
    const { data: allBookingsRaw, error: allBookingsError } = await supabase
      .from('bookings')
      .select('id, user_id, status, booked_at, guest_name, is_trial_booking')
      .eq('class_id', classId)
      .order('booked_at', { ascending: true })

    // Log for debugging
    if (allBookingsError) {
      console.error('[Attendance API] Bookings query error:', allBookingsError)
      console.log('[Attendance API] Raw bookings count: 0 (error occurred)')
    } else {
      console.log('[Attendance API] Raw bookings count:', allBookingsRaw?.length || 0)
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
              timeZone: 'Asia/Singapore',
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

    // Get user IDs from bookings (exclude null for guest/trial bookings)
    const userIds = [...new Set(bookings.map(b => b.user_id).filter(Boolean))] as string[]

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

    // Format ALL enrolled attendees (not just checked-in ones)
    // This allows the UI to show all students who registered, whether they've checked in or not
    const attendees = bookings.map(booking => {
        const user = booking.user_id ? userProfiles[booking.user_id] : null
        const checkedInAt = attendanceMap.get(booking.id)
        // Use guest_name for trial/guest bookings (user_id null), otherwise profile name
        const name = user?.name ?? (booking.guest_name?.trim() || 'Guest')
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .filter(Boolean)
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'G'

        return {
          id: booking.id,
          userId: booking.user_id,
          name,
          avatar: initials,
          isGuest: !!booking.is_trial_booking || !booking.user_id,
          checkedInAt: checkedInAt ? new Date(checkedInAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Singapore',
          }) : '',
        }
      })
      .sort((a, b) => {
        // Sort by check-in time (checked-in first, then by name)
        if (a.checkedInAt && !b.checkedInAt) return -1
        if (!a.checkedInAt && b.checkedInAt) return 1
        if (a.checkedInAt && b.checkedInAt) {
        return b.checkedInAt.localeCompare(a.checkedInAt)
        }
        return a.name.localeCompare(b.name)
      })

    const checkedInCount = attendees.filter(a => !!a.checkedInAt).length
    const expectedCount = attendees.length

    // Format class data (Singapore time)
    const scheduledAt = new Date(classData.scheduled_at)
    const timeStr = scheduledAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Singapore',
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
          enrolled: expectedCount,
          capacity: classData.capacity,
        },
        attendees,
        checkedIn: checkedInCount,
        expected: expectedCount,
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

