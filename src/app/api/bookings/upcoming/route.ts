/**
 * Upcoming Bookings API Route
 * GET /api/bookings/upcoming - Get current user's upcoming bookings
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { getUserBookings } from '@/services/booking.service'

/**
 * GET /api/bookings/upcoming - Get current user's upcoming bookings
 */
async function handleGetUpcoming(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const result = await getUserBookings({
      userId: context.user.id,
      status: 'confirmed',
      upcoming: true,
      page: 1,
      pageSize: 10,
    })

    // Transform bookings to match the dashboard format
    const bookings = result.bookings.map((booking) => {
      const classData = booking.class as any
      return {
        id: booking.id,
        class_name: classData?.title || 'Unknown Class',
        instructor_name: classData?.instructorName || 'TBA',
        scheduled_at: classData?.scheduledAt || booking.bookedAt,
        location: classData?.location || 'Studio',
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        bookings,
      },
    })
  } catch (error) {
    console.error('Error getting upcoming bookings:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to get upcoming bookings',
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withAuthentication(handleGetUpcoming)

