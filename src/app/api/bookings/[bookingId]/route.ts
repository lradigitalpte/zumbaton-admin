// Single Booking API Route
// Handles operations on a specific booking

import { NextRequest, NextResponse } from 'next/server'
import { cancelBooking, getUserBookings } from '@/services/booking.service'
import { UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'

// Cancel booking schema with userId
const CancelSchema = z.object({
  userId: UuidSchema,
  reason: z.string().max(500).optional(),
})

interface RouteParams {
  params: Promise<{ bookingId: string }>
}

// GET /api/bookings/[bookingId] - Get a specific booking
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { bookingId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    // Validate UUID
    UuidSchema.parse(bookingId)

    if (!userId) {
      throw new ApiError('VALIDATION_ERROR', 'userId is required', 400)
    }
    UuidSchema.parse(userId)

    // Get user's bookings and find this one
    const result = await getUserBookings({ userId, page: 1, pageSize: 100 })
    const booking = result.bookings.find(b => b.id === bookingId)

    if (!booking) {
      throw new ApiError('NOT_FOUND_ERROR', 'Booking not found', 404)
    }

    return NextResponse.json({
      success: true,
      data: booking,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/bookings/[bookingId] - Cancel a booking
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { bookingId } = await params
    const body = await request.json()

    // Validate UUID
    UuidSchema.parse(bookingId)

    // Validate request body
    const validatedData = CancelSchema.parse(body)

    const result = await cancelBooking({
      bookingId,
      userId: validatedData.userId,
      reason: validatedData.reason,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// Error handler helper
function handleApiError(error: unknown) {
  console.error('[API /bookings/[bookingId]]', error)

  if (error instanceof ApiError) {
    return NextResponse.json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    }, { status: error.statusCode })
  }

  // Zod validation error
  if (error && typeof error === 'object' && 'errors' in error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: (error as { errors: unknown[] }).errors,
      },
    }, { status: 400 })
  }

  return NextResponse.json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  }, { status: 500 })
}
