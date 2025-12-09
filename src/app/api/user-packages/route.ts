// User Packages API Route
// Handles user package operations

import { NextRequest, NextResponse } from 'next/server'
import { purchasePackage, getUserPackages } from '@/services/user-package.service'
import { UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'

// Extended purchase schema with userId for admin operations
const PurchaseRequestSchema = z.object({
  userId: UuidSchema,
  packageId: UuidSchema,
  paymentId: z.string().max(255).optional(),
})

// GET /api/user-packages - Get user's packages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('userId')
    
    if (!userId) {
      throw new ApiError('VALIDATION_ERROR', 'userId is required', 400)
    }

    // Validate userId
    UuidSchema.parse(userId)

    const query = {
      userId,
      status: (searchParams.get('status') as 'active' | 'expired' | 'depleted' | 'frozen') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 20,
    }

    const result = await getUserPackages(query)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/user-packages - Purchase a package
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validatedData = PurchaseRequestSchema.parse(body)

    // Purchase package
    const result = await purchasePackage(validatedData)

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
  console.error('[API /user-packages]', error)

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
