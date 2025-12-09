/**
 * Current User Profile API Routes
 * GET /api/users/me - Get current user profile
 * PUT /api/users/me - Update current user profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { getCurrentUserProfile, updateUserProfile } from '@/services/user.service'
import { createAuditLog } from '@/services/rbac.service'
import { UpdateUserProfileRequestSchema } from '@/api/schemas/user'

/**
 * GET /api/users/me - Get current user's profile
 */
async function handleGetMe(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const profile = await getCurrentUserProfile(context.user.id)

    return NextResponse.json({ data: profile })
  } catch (error) {
    console.error('Error getting user profile:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get user profile' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/users/me - Update current user's profile
 */
async function handleUpdateMe(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const body = await request.json()
    const parseResult = UpdateUserProfileRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const updatedProfile = await updateUserProfile(context.user.id, context.user.id, parseResult.data)

    // Log the action
    await createAuditLog({
      userId: context.user.id,
      action: 'update_profile',
      resourceType: 'users',
      resourceId: context.user.id,
      newValues: { updatedFields: Object.keys(parseResult.data) }
    })

    return NextResponse.json({ data: updatedProfile })
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update user profile' },
      { status: 500 }
    )
  }
}

// Export handlers - only requires authentication, no specific role
export const GET = withAuthentication(handleGetMe)
export const PUT = withAuthentication(handleUpdateMe)
