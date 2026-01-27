/**
 * Individual User API Routes
 * GET /api/users/[userId] - Get user by ID
 * PUT /api/users/[userId] - Update user (admin)
 * DELETE /api/users/[userId] - Deactivate user (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { withSelfOrAdmin, withAuth, AuthenticatedUser, hasRequiredRole } from '@/middleware/rbac'
import { getUserProfile, updateUserProfile, updateUserStatus, updateUserRole, deleteUser } from '@/services/user.service'
import { createAuditLog } from '@/services/rbac.service'
import { UpdateUserProfileRequestSchema, UpdateUserProfileAdminRequestSchema, UpdateUserStatusRequestSchema, UpdateUserRoleRequestSchema } from '@/api/schemas/user'
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
    }
    // Admin updating user profile (including personal info)
    else if (isAdmin && !isSelf && (body.name !== undefined || body.email !== undefined || body.phone !== undefined || body.dateOfBirth !== undefined || body.gender !== undefined || body.bloodGroup !== undefined)) {
      const parseResult = UpdateUserProfileAdminRequestSchema.safeParse(body)
      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid request body', details: parseResult.error.issues },
          { status: 400 }
        )
      }
      updatedProfile = await updateUserProfile(context.user.id, targetUserId, parseResult.data)
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

    // Invalidate Next.js cache for this user's route
    revalidatePath(`/api/users/${targetUserId}`)
    revalidatePath(`/users/${targetUserId}`)
    revalidatePath(`/users/staff/${targetUserId}`)

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
 * DELETE /api/users/[userId] - Deactivate user (soft delete)
 * Sets isActive to false instead of actually deleting the user
 */
async function handleDeleteUser(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const params = await context.params
    const { userId } = params

    // Cannot deactivate yourself
    if (userId === context.user.id) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Cannot deactivate your own account' },
        { status: 400 }
      )
    }

    // Use updateUserStatus to set isActive to false (soft delete)
    const updatedProfile = await updateUserStatus(context.user.id, userId, {
      isActive: false
    })

    // Sign out all sessions for the deactivated user to prevent them from continuing to use the app
    try {
      const { getSupabaseAdminClient } = await import('@/lib/supabase')
      const supabaseAdmin = getSupabaseAdminClient()
      // Sign out all sessions for this user - this invalidates all their JWT tokens
      await supabaseAdmin.auth.admin.signOut(userId)
      console.log('[Deactivate User] Signed out all sessions for user:', userId)
    } catch (signOutError) {
      console.error('[Deactivate User] Failed to sign out user sessions:', signOutError)
      // Don't fail the deactivation if sign-out fails - the isActive check will still prevent access
    }

    // Log the action
    await createAuditLog({
      userId: context.user.id,
      action: 'deactivate_user',
      resourceType: 'users',
      resourceId: userId,
      newValues: { isActive: false }
    })

    // Invalidate Next.js cache
    revalidatePath(`/api/users/${userId}`)
    revalidatePath(`/users/${userId}`)

    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully',
      data: updatedProfile
    })
  } catch (error) {
    console.error('Error deactivating user:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to deactivate user' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/[userId] - Reactivate user
 * Sets isActive to true to reactivate a deactivated user
 */
async function handleReactivateUser(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const params = await context.params
    const { userId } = params

    // Use updateUserStatus to set isActive to true (reactivate)
    const updatedProfile = await updateUserStatus(context.user.id, userId, {
      isActive: true
    })

    // Log the action
    await createAuditLog({
      userId: context.user.id,
      action: 'reactivate_user',
      resourceType: 'users',
      resourceId: userId,
      newValues: { isActive: true }
    })

    // Invalidate Next.js cache
    revalidatePath(`/api/users/${userId}`)
    revalidatePath(`/users/${userId}`)

    return NextResponse.json({
      success: true,
      message: 'User reactivated successfully',
      data: updatedProfile
    })
  } catch (error) {
    console.error('Error reactivating user:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to reactivate user' },
      { status: 500 }
    )
  }
}

// Export handlers with appropriate protection
export const GET = withSelfOrAdmin(handleGetUser)
export const PUT = withSelfOrAdmin(handleUpdateUser)
export const PATCH = withAuth(handleReactivateUser, { requiredRole: 'admin' }) // Admin can reactivate users
export const DELETE = withAuth(handleDeleteUser, { requiredRole: 'admin' }) // Admin can deactivate users (soft delete)
