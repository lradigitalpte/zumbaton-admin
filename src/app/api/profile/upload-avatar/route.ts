/**
 * Avatar Upload API Route for Admin
 * POST /api/profile/upload-avatar - Upload admin avatar image
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

/**
 * POST /api/profile/upload-avatar - Upload avatar image
 */
async function handleUploadAvatar(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const user = context.user
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
          message: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.',
        },
      }, { status: 400 })
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'File size too large. Maximum size is 5MB.',
        },
      }, { status: 400 })
    }

    // Generate unique filename: userId-timestamp.ext
    const fileExt = file.name.split('.').pop()
    const fileName = `admin-${user.id}-${Date.now()}.${fileExt}`
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
      console.error('[API /profile/upload-avatar] Upload error:', uploadError)
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
      .eq('id', user.id)

    if (updateError) {
      console.error('[API /profile/upload-avatar] Update error:', updateError)
      // Try to delete the uploaded file if profile update fails
      await adminClient.storage.from('avatars').remove([filePath])
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to update profile with avatar URL',
        },
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        avatarUrl: publicUrl,
        message: 'Avatar uploaded successfully',
      },
    })
  } catch (error) {
    console.error('[API /profile/upload-avatar]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

export const POST = withAuthentication(handleUploadAvatar)