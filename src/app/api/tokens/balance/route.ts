// Tokens Balance API Route
// Gets user token balance and booking eligibility

import { NextRequest, NextResponse } from 'next/server'
import { getUserTokenBalance, canBookClass, getTokenTransactions } from '@/services/token.service'
import { UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'

// GET /api/tokens/balance - Get user's token balance
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('userId')
    const tokenCost = searchParams.get('tokenCost')
    
    if (!userId) {
      throw new ApiError('VALIDATION_ERROR', 'userId is required', 400)
    }

    // Validate userId
    UuidSchema.parse(userId)

    // Get balance
    const balance = await getUserTokenBalance(userId)

    // If tokenCost is provided, also check booking eligibility
    let canBook = null
    if (tokenCost) {
      const cost = parseInt(tokenCost)
      if (isNaN(cost) || cost < 1) {
        throw new ApiError('VALIDATION_ERROR', 'tokenCost must be a positive integer', 400)
      }
      canBook = await canBookClass(userId, cost)
    }

    return NextResponse.json({
      success: true,
      data: {
        balance,
        canBook,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// Error handler helper
function handleApiError(error: unknown) {
  console.error('[API /tokens/balance]', error)

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
