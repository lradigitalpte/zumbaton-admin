// Waitlist API Route
// Handles waitlist operations

import { NextRequest, NextResponse } from 'next/server'
import { joinWaitlist, leaveWaitlist, getUserWaitlist, getAdminWaitlist } from '@/services/waitlist.service'
import { AdminWaitlistQuerySchema, UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { z } from 'zod'

// Extended join waitlist schema with userId
const JoinWaitlistSchema = z.object({
  userId: UuidSchema,
  classId: UuidSchema,
})

// GET /api/waitlist - Get waitlist entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('userId')
    const classId = searchParams.get('classId')
    const isAdmin = searchParams.get('admin') === 'true'

    if (isAdmin) {
      // Admin query
      const query = {
        classId: classId || undefined,
        userId: userId || undefined,
        status: (searchParams.get('status') as 'waiting' | 'notified' | 'expired' | 'converted' | 'cancelled') || undefined,
        page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
        pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 20,
      }

      const validatedQuery = AdminWaitlistQuerySchema.parse(query)
      const result = await getAdminWaitlist(validatedQuery)

      return NextResponse.json({
        success: true,
        data: result,
      })
    }

    // User query
    if (!userId) {
      throw new ApiError('VALIDATION_ERROR', 'userId is required for non-admin queries', 400)
    }

    UuidSchema.parse(userId)
    const result = await getUserWaitlist(userId)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/waitlist - Join waitlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validatedData = JoinWaitlistSchema.parse(body)

    const result = await joinWaitlist(validatedData)

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/waitlist - Leave waitlist
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('userId')
    const classId = searchParams.get('classId')

    if (!userId || !classId) {
      throw new ApiError('VALIDATION_ERROR', 'userId and classId are required', 400)
    }

    UuidSchema.parse(userId)
    UuidSchema.parse(classId)

    const result = await leaveWaitlist({ userId, classId })

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
  console.error('[API /waitlist]', error)

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
