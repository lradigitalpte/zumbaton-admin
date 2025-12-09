// Classes API Route
// Handles class CRUD operations

import { NextRequest, NextResponse } from 'next/server'
import { createClass, listClasses } from '@/services/class.service'
import { CreateClassRequestSchema, ClassListQuerySchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'

// GET /api/classes - List all classes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query params
    const query = {
      classType: searchParams.get('classType') || undefined,
      level: searchParams.get('level') || undefined,
      status: searchParams.get('status') || undefined,
      instructorId: searchParams.get('instructorId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 20,
    }

    // Validate query
    const validatedQuery = ClassListQuerySchema.parse(query)
    
    // Get classes
    const result = await listClasses(validatedQuery)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/classes - Create a new class
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate base request body
    const validatedData = CreateClassRequestSchema.parse(body)

    // Create class with extended fields
    const result = await createClass({
      ...validatedData,
      roomId: body.roomId,
      categoryId: body.categoryId,
      recurrenceType: body.recurrenceType,
      recurrencePattern: body.recurrencePattern,
    })

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
  console.error('[API /classes]', error)

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
