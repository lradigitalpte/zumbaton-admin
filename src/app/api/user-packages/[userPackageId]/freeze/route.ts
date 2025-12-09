// User Package Freeze API Route
// Handles freezing and unfreezing packages

import { NextRequest, NextResponse } from 'next/server'
import { freezePackage, unfreezePackage } from '@/services/user-package.service'
import { UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'

// Extended freeze request schema with userId
const FreezeRequestSchema = z.object({
  userId: UuidSchema,
  freezeDays: z.number().int().positive().max(30, 'Maximum freeze is 30 days').default(7),
})

interface RouteParams {
  params: Promise<{ userPackageId: string }>
}

// POST /api/user-packages/[userPackageId]/freeze - Freeze a package
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userPackageId } = await params
    const body = await request.json()

    // Validate UUID
    UuidSchema.parse(userPackageId)

    // Validate request body
    const validatedData = FreezeRequestSchema.parse(body)

    const result = await freezePackage({
      userId: validatedData.userId,
      userPackageId,
      freezeDays: validatedData.freezeDays,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/user-packages/[userPackageId]/freeze - Unfreeze a package
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userPackageId } = await params

    // Validate UUID
    UuidSchema.parse(userPackageId)

    const result = await unfreezePackage(userPackageId)

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
  console.error('[API /user-packages/[userPackageId]/freeze]', error)

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
