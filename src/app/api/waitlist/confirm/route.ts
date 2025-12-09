// Waitlist Confirm API Route
// Handles confirming a waitlist spot

import { NextRequest, NextResponse } from 'next/server'
import { confirmWaitlistSpot } from '@/services/waitlist.service'
import { UuidSchema } from '@/api/schemas'
import { z } from 'zod'
import { ApiError } from '@/lib/api-error'

// Schema for confirm request
const ConfirmWaitlistRequestSchema = z.object({
  userId: UuidSchema,
  waitlistId: UuidSchema,
})

// POST /api/waitlist/confirm - Confirm waitlist spot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validatedData = ConfirmWaitlistRequestSchema.parse(body)

    const result = await confirmWaitlistSpot(validatedData)

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
  console.error('[API /waitlist/confirm]', error)

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
