// Bookings API Route
// Handles booking operations

import { NextRequest, NextResponse } from 'next/server'
import { createBooking, getUserBookings } from '@/services/booking.service'
import { UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'

// Extended booking schema with userId
const CreateBookingSchema = z.object({
  userId: UuidSchema,
  classId: UuidSchema,
})

// GET /api/bookings - List bookings (by user)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('userId')
    const status = searchParams.get('status') || undefined
    const upcoming = searchParams.get('upcoming') === 'true'
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 20

    if (!userId) {
      throw new ApiError('VALIDATION_ERROR', 'userId is required', 400)
    }

    // Validate userId
    UuidSchema.parse(userId)
    
    const result = await getUserBookings({
      userId,
      status,
      upcoming,
      page,
      pageSize,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/bookings - Create a new booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validatedData = CreateBookingSchema.parse(body)

    // Create booking
    const result = await createBooking(validatedData)

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

// Error handler helper
function handleApiError(error: unknown) {
  console.error('[API /bookings]', error)

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
