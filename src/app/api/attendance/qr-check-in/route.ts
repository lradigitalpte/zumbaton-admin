// QR Code Check-in API Route
// Handles QR code scanning and check-in operations

import { NextRequest, NextResponse } from 'next/server'
import { checkIn } from '@/services/attendance.service'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'

// QR code data schema
const QRCodeDataSchema = z.object({
  classId: z.string().uuid(),
  token: z.string().min(1),
  sessionDate: z.string().optional(),
  sessionTime: z.string().optional(),
  expiresAt: z.number().optional(),
})

// QR check-in request schema
const QRCheckInSchema = z.object({
  qrData: QRCodeDataSchema,
  userId: z.string().uuid(), // User scanning the QR code
})

// POST /api/attendance/qr-check-in - Check in via QR code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = QRCheckInSchema.parse(body)

    const { qrData, userId } = validatedData
    const adminClient = getSupabaseAdminClient()

    // 1. Validate QR token expiration (if provided)
    if (qrData.expiresAt && qrData.expiresAt < Date.now()) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'QR_EXPIRED',
          message: 'QR code has expired. Please scan a fresh code.',
        },
      }, { status: 400 })
    }

    // 2. Get the class to verify it exists and get scheduled time
    const { data: classData, error: classError } = await adminClient
      .from(TABLES.CLASSES)
      .select('id, title, scheduled_at, duration_minutes, status')
      .eq('id', qrData.classId)
      .single()

    if (classError || !classData) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CLASS_NOT_FOUND',
          message: 'Class not found or invalid QR code.',
        },
      }, { status: 404 })
    }

    // 3. Find user's booking for this class
    const { data: booking, error: bookingError } = await adminClient
      .from(TABLES.BOOKINGS)
      .select(`
        id,
        user_id,
        class_id,
        status,
        tokens_used,
        user_package_id,
        booked_at
      `)
      .eq('user_id', userId)
      .eq('class_id', qrData.classId)
      .eq('status', 'confirmed')
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'No confirmed booking found for this class. Please book the class first.',
        },
      }, { status: 404 })
    }

    // 4. Verify booking belongs to the user (security check)
    if (booking.user_id !== userId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'This booking does not belong to you.',
        },
      }, { status: 403 })
    }

    // 5. Verify booking status is confirmed
    if (booking.status !== 'confirmed') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_BOOKING_STATUS',
          message: `Cannot check in. Booking status is: ${booking.status}`,
        },
      }, { status: 400 })
    }

    // 6. Check if already checked in (prevent duplicate check-ins)
    const { data: existingAttendance } = await adminClient
      .from(TABLES.ATTENDANCES)
      .select('id')
      .eq('booking_id', booking.id)
      .single()

    if (existingAttendance) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ALREADY_CHECKED_IN',
          message: 'You have already checked in for this class.',
        },
      }, { status: 400 })
    }

    // 7. Perform check-in (this will consume tokens and mark attendance)
    try {
      const result = await checkIn({
        bookingId: booking.id,
        method: 'qr-code',
        checkedInBy: userId, // User checking themselves in
        notes: `Checked in via QR code scan`,
      })

      return NextResponse.json({
        success: true,
        data: {
          attendance: result.attendance,
          tokensConsumed: result.tokensConsumed,
          tokensRemaining: result.tokensRemaining,
          message: result.message,
          classTitle: classData.title,
        },
      })
    } catch (checkInError: any) {
      // Handle check-in errors (e.g., outside check-in window, token issues)
      return NextResponse.json({
        success: false,
        error: {
          code: checkInError.code || 'CHECK_IN_ERROR',
          message: checkInError.message || 'Failed to check in. Please try again.',
        },
      }, { status: checkInError.statusCode || 400 })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

// Error handler helper
function handleApiError(error: unknown) {
  console.error('[API /attendance/qr-check-in]', error)

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
        message: 'Invalid QR code data',
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

