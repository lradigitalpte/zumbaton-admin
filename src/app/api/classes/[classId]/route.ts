// Single Class API Route
// Handles operations on a specific class

import { NextRequest, NextResponse } from 'next/server'
import { getClass, updateClass, cancelClass } from '@/services/class.service'
import { UpdateClassRequestSchema, UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'

// Cancel request schema
const CancelClassSchema = z.object({
  reason: z.string().max(500).optional(),
})

interface RouteParams {
  params: Promise<{ classId: string }>
}

// GET /api/classes/[classId] - Get a specific class with availability
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { classId } = await params
    
    // Validate UUID
    UuidSchema.parse(classId)

    // Get class (includes availability info)
    const classData = await getClass(classId)

    return NextResponse.json({
      success: true,
      data: classData,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/classes/[classId] - Update a class
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { classId } = await params
    const body = await request.json()

    // Validate UUID
    UuidSchema.parse(classId)

    // Validate request body
    const validatedData = UpdateClassRequestSchema.parse(body)

    const result = await updateClass(classId, validatedData)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/classes/[classId] - Cancel a class
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { classId } = await params

    // Validate UUID
    UuidSchema.parse(classId)

    const result = await cancelClass(classId)

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
  console.error('[API /classes/[classId]]', error)

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
