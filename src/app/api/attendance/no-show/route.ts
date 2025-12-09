// Attendance No-Show API Route
// Handles marking bookings as no-show

import { NextRequest, NextResponse } from 'next/server'
import { markNoShow } from '@/services/attendance.service'
import { UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'

// No-show request schema with markedBy
const NoShowSchema = z.object({
  bookingId: UuidSchema,
  markedBy: UuidSchema,
  notes: z.string().max(500).optional(),
})

// POST /api/attendance/no-show - Mark a booking as no-show
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validatedData = NoShowSchema.parse(body)

    const result = await markNoShow({
      bookingId: validatedData.bookingId,
      markedBy: validatedData.markedBy,
      notes: validatedData.notes,
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
  console.error('[API /attendance/no-show]', error)

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
