/**
 * Physical Form Upload API Route for Admin
 * POST /api/users/upload-physical-form - Upload physical form document
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

/**
 * POST /api/users/upload-physical-form - Upload physical form document
 */
async function handleUploadPhysicalForm(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const adminClient = getSupabaseAdminClient()

    // Get the file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null
    const currentUser = context.user

    if (!file) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file provided',
        },
      }, { status: 400 })
    }

    // Validate file type - allow PDF and images
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid file type. Please upload a PDF, JPEG, PNG, or WebP file.',
        },
      }, { status: 400 })
    }

    // Validate file size (10MB max for documents)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'File size too large. Maximum size is 10MB.',
        },
      }, { status: 400 })
    }

    // Generate unique filename: physical-forms/{adminUserId}-{timestamp}.ext
    // Use admin user ID to track who uploaded it, or use temp prefix if creating new user
    const fileExt = file.name.split('.').pop()
    const timestamp = Date.now()
    const fileName = userId ? `${userId}-${timestamp}.${fileExt}` : `admin-${currentUser.id}-${timestamp}.${fileExt}`
    const filePath = `physical-forms/${fileName}`

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Try uploading to 'documents' bucket first (preferred)
    let bucketUsed = 'documents'
    
    const { data: documentsUploadData, error: documentsUploadError } = await adminClient.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (documentsUploadError) {
      console.log('[API /users/upload-physical-form] Documents bucket upload failed, trying avatars bucket as fallback')
      console.error('[API /users/upload-physical-form] Documents bucket error:', documentsUploadError)
      
      // Fallback to 'avatars' bucket if documents bucket fails
      const { data: avatarsUploadData, error: avatarsUploadError } = await adminClient.storage
        .from('avatars')
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        })
      
      if (avatarsUploadError) {
        console.error('[API /users/upload-physical-form] Avatars bucket fallback also failed:', avatarsUploadError)
        return NextResponse.json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: avatarsUploadError.message || 'Failed to upload file to both documents and avatars buckets. Please ensure storage is configured.',
          },
        }, { status: 500 })
      }
      
      // Success with avatars bucket fallback
      bucketUsed = 'avatars'
      console.log('[API /users/upload-physical-form] Successfully uploaded to avatars bucket (fallback)')
    } else {
      // Success with documents bucket
      console.log('[API /users/upload-physical-form] Successfully uploaded to documents bucket')
    }

    // Get public URL for the uploaded file from the bucket that was used
    const { data: urlData } = adminClient.storage
      .from(bucketUsed)
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        path: filePath,
        bucket: bucketUsed,
        message: `Physical form uploaded successfully${bucketUsed === 'avatars' ? ' (using fallback bucket)' : ''}`,
      },
    })
  } catch (error) {
    console.error('[API /users/upload-physical-form]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

export const POST = withAuth(handleUploadPhysicalForm, { requiredRole: 'admin' })
