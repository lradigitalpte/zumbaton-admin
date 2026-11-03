// Attendance Check-in API Route
// Handles check-in operations

import { NextRequest, NextResponse } from 'next/server'
import { checkIn, bulkCheckIn } from '@/services/attendance.service'
import { UuidSchema, CheckInMethodSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { createAuditLog } from '@/services/rbac.service'
import { z } from 'zod'

// Check-in request schema with checkedInBy
const CheckInSchema = z.object({
  bookingId: UuidSchema,
  method: CheckInMethodSchema.default('manual'),
  checkedInBy: UuidSchema,
  notes: z.string().max(500).optional(),
})

// Bulk check-in schema
const BulkCheckInSchema = z.object({
  bookingIds: z.array(UuidSchema).min(1).max(50),
  checkedInBy: UuidSchema,
  notes: z.string().max(500).optional(),
})

// POST /api/attendance/check-in - Check in a single booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if it's a bulk check-in request
    if (Array.isArray(body.bookingIds)) {
      // Validate bulk request
      const validatedData = BulkCheckInSchema.parse(body)
      
      const result = await bulkCheckIn({
        bookingIds: validatedData.bookingIds,
        method: 'admin',
        checkedInBy: validatedData.checkedInBy,
        notes: validatedData.notes,
      })
      const actor = await getAuthenticatedUser(request)
      await createAuditLog({
        userId: actor?.id || validatedData.checkedInBy,
        action: 'attendance.check_in',
        resourceType: 'bookings',
        resourceId: validatedData.bookingIds[0],
        newValues: { bookingCount: validatedData.bookingIds.length, notes: validatedData.notes || null },
      })

      return NextResponse.json({
        success: true,
        data: result,
      })
    }

    // Single check-in
    const validatedData = CheckInSchema.parse(body)

    const result = await checkIn({
      bookingId: validatedData.bookingId,
      method: validatedData.method,
      checkedInBy: validatedData.checkedInBy,
      notes: validatedData.notes,
    })
    const actor = await getAuthenticatedUser(request)
    await createAuditLog({
      userId: actor?.id || validatedData.checkedInBy,
      action: 'attendance.check_in',
      resourceType: 'bookings',
      resourceId: validatedData.bookingId,
      newValues: { method: validatedData.method, notes: validatedData.notes || null },
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
  console.error('[API /attendance/check-in]', error)

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
