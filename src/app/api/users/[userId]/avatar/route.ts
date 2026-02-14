/**
 * User Avatar Upload API Route (Admin)
 * POST /api/users/[userId]/avatar - Upload user avatar (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser, hasRequiredRole } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

type RouteParams = { userId: string }

/**
 * POST /api/users/[userId]/avatar - Upload avatar for a user (admin only)
 */
async function handleUploadUserAvatar(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    // Check admin permission
    const isAdmin = hasRequiredRole(context.user.role, 'admin')
    const isSuperAdmin = hasRequiredRole(context.user.role, 'super_admin')

    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can upload user avatars',
        },
      }, { status: 403 })
    }

    const params = await context.params
    const { userId } = params
    const adminClient = getSupabaseAdminClient()

    // Get the file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file provided',
        },
      }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.',
        },
      }, { status: 400 })
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'File too large. Maximum file size is 5MB.',
        },
      }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `user-${userId}-${timestamp}-${random}.${fileExt}`
    const filePath = fileName

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false, // Don't overwrite existing files
      })

    if (uploadError) {
      console.error('[API /users/[userId]/avatar] Upload error:', uploadError)
      return NextResponse.json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: 'Failed to upload image',
        },
      }, { status: 500 })
    }

    // Get public URL for the uploaded file
    const { data: urlData } = adminClient.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    // Update user profile with new avatar URL
    const { error: updateError } = await adminClient
      .from('user_profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[API /users/[userId]/avatar] Update error:', updateError)
      // Try to delete the uploaded file if profile update fails
      await adminClient.storage.from('avatars').remove([filePath])

      return NextResponse.json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update user profile',
        },
      }, { status: 500 })
    }

    // Create audit log
    try {
      await adminClient
        .from('audit_logs')
        .insert({
          user_id: context.user.id,
          action: 'user_avatar_upload',
          resource_id: userId,
          resource_type: 'user',
          description: `Admin uploaded avatar for user ${userId}`,
          changes: {
            avatar_url: publicUrl,
          },
        })
    } catch (auditError) {
      console.warn('[API /users/[userId]/avatar] Failed to create audit log:', auditError)
      // Non-critical error, continue
    }

    return NextResponse.json({
      success: true,
      data: {
        avatarUrl: publicUrl,
        fileName: filePath,
      },
    })
  } catch (error) {
    console.error('[API /users/[userId]/avatar] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to upload avatar',
      },
    }, { status: 500 })
  }
}

export const POST = withAuthentication(handleUploadUserAvatar)
