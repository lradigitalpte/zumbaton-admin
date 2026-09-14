// User Package Extend Expiry API Route
// Lets an admin push a specific package's expiry date further out

import { NextRequest, NextResponse } from 'next/server'
import { extendPackageExpiry } from '@/services/user-package.service'
import { UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'

const ExtendExpiryRequestSchema = z.object({
  userId: UuidSchema,
  days: z.number().int().positive().max(365, 'Maximum extension is 365 days'),
})

interface RouteParams {
  params: Promise<{ userPackageId: string }>
}

// POST /api/user-packages/[userPackageId]/extend-expiry - Extend a package's expiry date
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userPackageId } = await params
    const body = await request.json()

    UuidSchema.parse(userPackageId)
    const validatedData = ExtendExpiryRequestSchema.parse(body)

    const result = await extendPackageExpiry({
      userId: validatedData.userId,
      userPackageId,
      days: validatedData.days,
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
  console.error('[API /user-packages/[userPackageId]/extend-expiry]', error)

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
