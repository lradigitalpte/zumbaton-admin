import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

// Type for availability slot from DB
interface AvailabilitySlot {
  id: string
  instructor_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

// Type for time off request from DB
interface TimeOffRequestDB {
  id: string
  instructor_id: string
  start_date: string
  end_date: string
  reason: string | null
  status: string
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const supabase = getSupabaseAdminClient()

    // Get instructor's availability slots
    const { data: availabilitySlots, error: availabilityError } = await supabase
      .from('instructor_availability')
      .select('*')
      .eq('instructor_id', user.id)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })

    if (availabilityError) {
      console.error('Error fetching availability:', availabilityError)
      // Return empty if table doesn't exist yet
      if (availabilityError.code === '42P01') {
        return NextResponse.json({
          success: true,
          data: {
            availability: {},
            timeOffRequests: [],
            stats: {
              hoursPerWeek: 0,
              daysAvailable: 0,
              pendingRequests: 0,
              approvedTimeOff: 0
            }
          }
        })
      }
    }

    // Get instructor's time off requests
    const { data: timeOffRequests, error: timeOffError } = await supabase
      .from('time_off_requests')
      .select('*')
      .eq('instructor_id', user.id)
      .gte('end_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true })

    if (timeOffError && timeOffError.code !== '42P01') {
      console.error('Error fetching time off:', timeOffError)
    }

    // Transform availability slots into grouped format
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const availability: Record<string, { enabled: boolean; slots: Array<{ start: string; end: string }> }> = {}
    
    dayNames.forEach((day, index) => {
      const daySlots = ((availabilitySlots || []) as AvailabilitySlot[]).filter(s => s.day_of_week === index)
      availability[day] = {
        enabled: daySlots.length > 0,
        slots: daySlots.map(s => ({
          start: s.start_time.substring(0, 5), // Remove seconds
          end: s.end_time.substring(0, 5)
        }))
      }
    })

    // Calculate stats
    let totalHours = 0
    Object.values(availability).forEach(day => {
      if (day.enabled) {
        day.slots.forEach(slot => {
          const startParts = slot.start.split(':')
          const endParts = slot.end.split(':')
          const startHours = parseInt(startParts[0]) + parseInt(startParts[1]) / 60
          const endHours = parseInt(endParts[0]) + parseInt(endParts[1]) / 60
          totalHours += endHours - startHours
        })
      }
    })

    const typedTimeOffRequests = (timeOffRequests || []) as TimeOffRequestDB[]
    const daysAvailable = Object.values(availability).filter(d => d.enabled).length
    const pendingRequests = typedTimeOffRequests.filter(r => r.status === 'pending').length
    const approvedTimeOff = typedTimeOffRequests.filter(r => r.status === 'approved').length

    return NextResponse.json({
      success: true,
      data: {
        availability,
        timeOffRequests: typedTimeOffRequests.map(r => ({
          id: r.id,
          startDate: r.start_date,
          endDate: r.end_date,
          reason: r.reason,
          status: r.status,
          createdAt: r.created_at
        })),
        stats: {
          hoursPerWeek: totalHours,
          daysAvailable,
          pendingRequests,
          approvedTimeOff
        }
      }
    })
  } catch (error) {
    console.error('Availability API error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { availability } = body

    if (!availability) {
      return NextResponse.json(
        { success: false, error: { message: 'Availability data required' } },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()

    // Delete existing availability
    const { error: deleteError } = await supabase
      .from('instructor_availability')
      .delete()
      .eq('instructor_id', user.id)

    if (deleteError && deleteError.code !== '42P01') {
      console.error('Error deleting old availability:', deleteError)
    }

    // Insert new availability slots
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const newSlots: Array<{
      instructor_id: string
      day_of_week: number
      start_time: string
      end_time: string
      is_active: boolean
    }> = []

    dayNames.forEach((day, index) => {
      const dayData = availability[day]
      if (dayData?.enabled && dayData.slots?.length > 0) {
        dayData.slots.forEach((slot: { start: string; end: string }) => {
          newSlots.push({
            instructor_id: user.id,
            day_of_week: index,
            start_time: slot.start + ':00',
            end_time: slot.end + ':00',
            is_active: true
          })
        })
      }
    })

    if (newSlots.length > 0) {
      const { error: insertError } = await supabase
        .from('instructor_availability')
        .insert(newSlots)

      if (insertError) {
        console.error('Error inserting availability:', insertError)
        return NextResponse.json(
          { success: false, error: { message: 'Failed to save availability' } },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Availability updated successfully' }
    })
  } catch (error) {
    console.error('Availability PUT error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, ...data } = body

    const supabase = getSupabaseAdminClient()

    if (action === 'request_time_off') {
      const { startDate, endDate, reason } = data

      if (!startDate || !endDate) {
        return NextResponse.json(
          { success: false, error: { message: 'Start and end dates required' } },
          { status: 400 }
        )
      }

      const { data: newRequest, error: insertError } = await supabase
        .from('time_off_requests')
        .insert({
          instructor_id: user.id,
          start_date: startDate,
          end_date: endDate,
          reason: reason || null,
          status: 'pending'
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating time off request:', insertError)
        return NextResponse.json(
          { success: false, error: { message: 'Failed to create time off request' } },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          id: newRequest.id,
          startDate: newRequest.start_date,
          endDate: newRequest.end_date,
          reason: newRequest.reason,
          status: newRequest.status,
          createdAt: newRequest.created_at
        }
      })
    }

    if (action === 'cancel_time_off') {
      const { requestId } = data

      if (!requestId) {
        return NextResponse.json(
          { success: false, error: { message: 'Request ID required' } },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from('time_off_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('instructor_id', user.id)
        .eq('status', 'pending')

      if (updateError) {
        console.error('Error cancelling time off:', updateError)
        return NextResponse.json(
          { success: false, error: { message: 'Failed to cancel request' } },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: { message: 'Time off request cancelled' }
      })
    }

    return NextResponse.json(
      { success: false, error: { message: 'Invalid action' } },
      { status: 400 }
    )
  } catch (error) {
    console.error('Availability POST error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
