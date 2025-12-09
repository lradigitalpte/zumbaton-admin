/**
 * Individual User API Routes
 * GET /api/users/[userId] - Get user by ID
 * PUT /api/users/[userId] - Update user (admin)
 * DELETE /api/users/[userId] - Deactivate user (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withSelfOrAdmin, withAuth, AuthenticatedUser, hasRequiredRole } from '@/middleware/rbac'
import { getUserProfile, updateUserProfile, updateUserStatus, updateUserRole, deleteUser } from '@/services/user.service'
import { createAuditLog } from '@/services/rbac.service'
import { UpdateUserProfileRequestSchema, UpdateUserStatusRequestSchema, UpdateUserRoleRequestSchema } from '@/api/schemas/user'
import { cachedResponse, CACHE_PRESETS } from '@/lib/api-cache'
import { ApiError, isApiError } from '@/lib/api-error'

type RouteParams = { userId: string }

/**
 * GET /api/users/[userId] - Get user profile by ID
 * Users can access their own profile, admins can access any
 */
async function handleGetUser(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const params = await context.params
    const { userId } = params

    // If userId is 'me', redirect to /api/users/me
    const targetUserId = userId === 'me' ? context.user.id : userId

    const profile = await getUserProfile(context.user.id, targetUserId)

    // If not admin and not self, hide sensitive info
    const isAdmin = hasRequiredRole(context.user.role, 'admin')
    const isSelf = targetUserId === context.user.id

    if (!isAdmin && !isSelf) {
      // Return limited public profile
      return NextResponse.json({
        data: {
          id: profile.id,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          role: profile.role
        }
      })
    }

    // Return cached response - reduces Next.js → Supabase calls
    return cachedResponse({ data: profile }, CACHE_PRESETS.users)
  } catch (error) {
    console.error('Error getting user:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get user' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/users/[userId] - Update user profile
 * Users can update their own profile, admins can update any user
 */
async function handleUpdateUser(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const params = await context.params
    const { userId } = params
    const targetUserId = userId === 'me' ? context.user.id : userId

    const body = await request.json()
    const isAdmin = hasRequiredRole(context.user.role, 'admin')
    const isSuperAdmin = hasRequiredRole(context.user.role, 'super_admin')
    const isSelf = targetUserId === context.user.id

    let updatedProfile

    // Super admin updating user role
    if (isSuperAdmin && !isSelf && body.role !== undefined) {
      const parseResult = UpdateUserRoleRequestSchema.safeParse({ role: body.role })
      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid request body', details: parseResult.error.issues },
          { status: 400 }
        )
      }
      updatedProfile = await updateUserRole(context.user.id, targetUserId, parseResult.data)
    }
    // Admin updating user status
    else if (isAdmin && !isSelf && (body.isActive !== undefined || body.isFlagged !== undefined)) {
      const parseResult = UpdateUserStatusRequestSchema.safeParse(body)
      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid request body', details: parseResult.error.issues },
          { status: 400 }
        )
      }
      updatedProfile = await updateUserStatus(context.user.id, targetUserId, parseResult.data)
    } else {
      // User updating self - limited fields
      const parseResult = UpdateUserProfileRequestSchema.safeParse(body)
      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid request body', details: parseResult.error.issues },
          { status: 400 }
        )
      }
      updatedProfile = await updateUserProfile(context.user.id, targetUserId, parseResult.data)
    }

    // Log the action
    await createAuditLog({
      userId: context.user.id,
      action: 'update_user',
      resourceType: 'users',
      resourceId: targetUserId,
      newValues: { 
        adminAction: isAdmin && !isSelf,
        updatedFields: Object.keys(body) 
      }
    })

    return NextResponse.json({ data: updatedProfile })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[userId] - Deactivate/suspend user (admin only)
 * This doesn't delete the user, just sets status to 'suspended'
 */
async function handleDeleteUser(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const params = await context.params
    const { userId } = params

    // Cannot delete yourself
    if (userId === context.user.id) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    await deleteUser(context.user.id, userId)

    // Log the action
    await createAuditLog({
      userId: context.user.id,
      action: 'delete_user',
      resourceType: 'users',
      resourceId: userId
    })

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    console.error('Error suspending user:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to suspend user' },
      { status: 500 }
    )
  }
}

// Export handlers with appropriate protection
export const GET = withSelfOrAdmin(handleGetUser)
export const PUT = withSelfOrAdmin(handleUpdateUser)
export const DELETE = withAuth(handleDeleteUser, { requiredRole: 'super_admin' })
