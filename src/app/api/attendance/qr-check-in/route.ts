// QR Code Check-in API Route
// Handles QR code scanning and check-in operations
// Supports both booked users and walk-in attendance

import { NextRequest, NextResponse } from 'next/server'
import { checkIn } from '@/services/attendance.service'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'

// QR code data schema - matches what QRCodeDisplay generates
const QRCodeDataSchema = z.object({
  classId: z.string().uuid(),
  token: z.string().min(1),
  sessionDate: z.string().optional(),
  sessionTime: z.string().optional(),
  expiresAt: z.number().optional(),
  className: z.string().optional(),
})

// QR check-in request schema
const QRCheckInSchema = z.object({
  qrData: QRCodeDataSchema,
  userId: z.string().uuid(), // User scanning the QR code
})

// Error codes for specific scenarios
const ERROR_CODES = {
  QR_EXPIRED: 'QR_EXPIRED',
  CLASS_NOT_FOUND: 'CLASS_NOT_FOUND',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  CHECK_IN_WINDOW_CLOSED: 'CHECK_IN_WINDOW_CLOSED',
  INSUFFICIENT_TOKENS: 'INSUFFICIENT_TOKENS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CLASS_CANCELLED: 'CLASS_CANCELLED',
  CLASS_FULL: 'CLASS_FULL',
}

// POST /api/attendance/qr-check-in - Check in via QR code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const parseResult = QRCheckInSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid QR code data format',
          details: parseResult.error.issues,
        },
      }, { status: 400 })
    }

    const { qrData, userId } = parseResult.data
    const adminClient = getSupabaseAdminClient()

    // 1. Validate QR token expiration (if provided)
    if (qrData.expiresAt && qrData.expiresAt < Date.now()) {
      return NextResponse.json({
        success: false,
        error: {
          code: ERROR_CODES.QR_EXPIRED,
          message: 'QR code has expired. Please scan the new code displayed on screen.',
        },
      }, { status: 400 })
    }

    // 2. Get the class to verify it exists
    const { data: classData, error: classError } = await adminClient
      .from(TABLES.CLASSES)
      .select('id, title, scheduled_at, duration_minutes, status, capacity, token_cost, instructor_id, allow_drop_in, drop_in_token_cost')
      .eq('id', qrData.classId)
      .single()

    if (classError || !classData) {
      return NextResponse.json({
        success: false,
        error: {
          code: ERROR_CODES.CLASS_NOT_FOUND,
          message: 'Class not found. The QR code may be invalid.',
        },
      }, { status: 404 })
    }

    // 3. Check if class is cancelled
    if (classData.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: {
          code: ERROR_CODES.CLASS_CANCELLED,
          message: 'This class has been cancelled.',
        },
      }, { status: 400 })
    }

    // 4. Check check-in time window
    const classTime = new Date(classData.scheduled_at)
    const now = new Date()
    const minutesUntilClass = (classTime.getTime() - now.getTime()) / (1000 * 60)
    const minutesAfterStart = -minutesUntilClass
    const classEndTime = new Date(classTime.getTime() + classData.duration_minutes * 60 * 1000)

    const CHECK_IN_WINDOW_BEFORE = 30 // 30 min before class
    const CHECK_IN_WINDOW_AFTER = 15 // 15 min after class start

    const canCheckIn = 
      (minutesUntilClass <= CHECK_IN_WINDOW_BEFORE && minutesUntilClass > -classData.duration_minutes)

    if (!canCheckIn) {
      if (minutesUntilClass > CHECK_IN_WINDOW_BEFORE) {
        return NextResponse.json({
          success: false,
          error: {
            code: ERROR_CODES.CHECK_IN_WINDOW_CLOSED,
            message: `Check-in opens ${CHECK_IN_WINDOW_BEFORE} minutes before class. Please come back later.`,
          },
        }, { status: 400 })
      } else {
        return NextResponse.json({
          success: false,
          error: {
            code: ERROR_CODES.CHECK_IN_WINDOW_CLOSED,
            message: 'This class has already ended. Check-in is no longer available.',
          },
        }, { status: 400 })
      }
    }

    // 5. Get user profile
    const { data: userProfile, error: userError } = await adminClient
      .from('user_profiles')
      .select('id, name, email')
      .eq('id', userId)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({
        success: false,
        error: {
          code: ERROR_CODES.USER_NOT_FOUND,
          message: 'User account not found. Please sign in again.',
        },
      }, { status: 404 })
    }

    // 6. Find user's booking for this class
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
      .in('status', ['confirmed', 'waitlist'])
      .single()

    // 7. Handle different scenarios
    
    // Scenario A: User has a confirmed booking
    if (booking && booking.status === 'confirmed') {
      // Check if already checked in
      const { data: existingAttendance } = await adminClient
        .from(TABLES.ATTENDANCES)
        .select('id')
        .eq('booking_id', booking.id)
        .single()

      if (existingAttendance) {
        return NextResponse.json({
          success: false,
          error: {
            code: ERROR_CODES.ALREADY_CHECKED_IN,
            message: 'You have already checked in for this class.',
          },
        }, { status: 400 })
      }

      // Perform check-in
      try {
        const result = await checkIn({
          bookingId: booking.id,
          method: 'qr-code',
          checkedInBy: userId,
          notes: 'Checked in via QR code scan',
        })

        return NextResponse.json({
          success: true,
          data: {
            attendance: result.attendance,
            tokensConsumed: result.tokensConsumed,
            tokensRemaining: result.tokensRemaining,
            message: result.message,
            classTitle: classData.title,
            userName: userProfile.name,
          },
        })
      } catch (checkInError: unknown) {
        const error = checkInError as { code?: string; message?: string; statusCode?: number }
        return NextResponse.json({
          success: false,
          error: {
            code: error.code || 'CHECK_IN_ERROR',
            message: error.message || 'Failed to check in. Please try again.',
          },
        }, { status: error.statusCode || 400 })
      }
    }

    // Scenario B: User is on waitlist
    if (booking && booking.status === 'waitlist') {
      return NextResponse.json({
        success: false,
        error: {
          code: ERROR_CODES.BOOKING_NOT_FOUND,
          message: 'You are on the waitlist for this class. You cannot check in until a spot becomes available.',
          action: 'waitlist',
        },
      }, { status: 400 })
    }

    // Scenario C: No booking found - check if class allows walk-in
    const allowsDropIn = classData.allow_drop_in === true

    if (!allowsDropIn) {
      return NextResponse.json({
        success: false,
        error: {
          code: ERROR_CODES.BOOKING_NOT_FOUND,
          message: 'You are not registered for this class. Please book the class through the app first.',
          action: 'book',
          classId: qrData.classId,
          classTitle: classData.title,
        },
      }, { status: 400 })
    }

    // Scenario D: Walk-in attendance allowed - check capacity and create booking
    
    // Check class capacity
    const { count: currentBookings } = await adminClient
      .from(TABLES.BOOKINGS)
      .select('*', { count: 'exact', head: true })
      .eq('class_id', qrData.classId)
      .in('status', ['confirmed', 'attended'])

    if (currentBookings && currentBookings >= classData.capacity) {
      return NextResponse.json({
        success: false,
        error: {
          code: ERROR_CODES.CLASS_FULL,
          message: 'This class is full. No walk-in spots available.',
        },
      }, { status: 400 })
    }

    // Get user's active package with enough tokens
    const tokenCost = classData.drop_in_token_cost || classData.token_cost || 1
    
    const { data: userPackages, error: packageError } = await adminClient
      .from(TABLES.USER_PACKAGES)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('tokens_remaining', 0)
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })

    if (packageError || !userPackages || userPackages.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: ERROR_CODES.INSUFFICIENT_TOKENS,
          message: 'You don\'t have any active tokens. Please purchase a token package first.',
          action: 'purchase',
        },
      }, { status: 400 })
    }

    // Find package with enough available tokens
    const availablePackage = userPackages.find(pkg => 
      (pkg.tokens_remaining - (pkg.tokens_held || 0)) >= tokenCost
    )

    if (!availablePackage) {
      return NextResponse.json({
        success: false,
        error: {
          code: ERROR_CODES.INSUFFICIENT_TOKENS,
          message: `You need ${tokenCost} token(s) for this class but don't have enough available.`,
          action: 'purchase',
        },
      }, { status: 400 })
    }

    // Create walk-in booking
    const { data: newBooking, error: createBookingError } = await adminClient
      .from(TABLES.BOOKINGS)
      .insert({
        user_id: userId,
        class_id: qrData.classId,
        user_package_id: availablePackage.id,
        tokens_used: tokenCost,
        status: 'confirmed',
        booked_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createBookingError || !newBooking) {
      console.error('[QR Check-in] Failed to create walk-in booking:', createBookingError)
      return NextResponse.json({
        success: false,
        error: {
          code: 'BOOKING_ERROR',
          message: 'Failed to create walk-in booking. Please try again.',
        },
      }, { status: 500 })
    }

    // Hold tokens for the booking
    const { error: holdError } = await adminClient
      .from(TABLES.USER_PACKAGES)
      .update({
        tokens_held: (availablePackage.tokens_held || 0) + tokenCost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', availablePackage.id)

    if (holdError) {
      console.error('[QR Check-in] Failed to hold tokens:', holdError)
      // Continue anyway - check-in will handle this
    }

    // Now check in the walk-in booking
    try {
      const result = await checkIn({
        bookingId: newBooking.id,
        method: 'qr-code',
        checkedInBy: userId,
        notes: 'Walk-in attendance via QR code scan',
      })

      return NextResponse.json({
        success: true,
        data: {
          attendance: result.attendance,
          tokensConsumed: result.tokensConsumed,
          tokensRemaining: result.tokensRemaining,
          message: `Walk-in check-in successful! ${result.tokensConsumed} token(s) consumed.`,
          classTitle: classData.title,
          userName: userProfile.name,
          wasWalkIn: true,
        },
      })
    } catch (checkInError: unknown) {
      // If check-in fails, try to clean up the booking
      await adminClient
        .from(TABLES.BOOKINGS)
        .delete()
        .eq('id', newBooking.id)

      const error = checkInError as { code?: string; message?: string; statusCode?: number }
      return NextResponse.json({
        success: false,
        error: {
          code: error.code || 'CHECK_IN_ERROR',
          message: error.message || 'Failed to check in. Please try again.',
        },
      }, { status: error.statusCode || 400 })
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
      message: 'An unexpected error occurred. Please try again.',
    },
  }, { status: 500 })
}
