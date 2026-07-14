// Single Booking API Route
// Handles operations on a specific booking

import { NextRequest, NextResponse } from 'next/server'
import { cancelBooking, getUserBookings } from '@/services/booking.service'
import { UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'
import { getSupabaseAdminClient } from '@/lib/supabase'

// Cancel booking schema with userId
const CancelSchema = z.object({
  userId: UuidSchema,
  reason: z.string().max(500).optional(),
  forceRefund: z.boolean().optional(),
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

    if (validatedData.forceRefund) {
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      if (!token) throw new ApiError('AUTHENTICATION_ERROR', 'Authentication required', 401)

      const adminClient = getSupabaseAdminClient()
      const { data: authData } = await adminClient.auth.getUser(token)
      const actorId = authData.user?.id
      if (!actorId) throw new ApiError('AUTHENTICATION_ERROR', 'Invalid session', 401)

      const { data: actorProfile } = await adminClient
        .from('user_profiles')
        .select('role')
        .eq('id', actorId)
        .single()
      if (!actorProfile || !['admin', 'super_admin'].includes(actorProfile.role)) {
        throw new ApiError('AUTHORIZATION_ERROR', 'Admin access required', 403)
      }
    }

    const result = await cancelBooking({
      bookingId,
      userId: validatedData.userId,
      reason: validatedData.reason,
      forceRefund: validatedData.forceRefund,
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
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    },
  }, { status: 500 })
}
