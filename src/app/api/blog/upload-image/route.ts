import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

const BUCKET = 'blog-images'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024

async function handleUpload(
  request: NextRequest,
  _context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
) {
  try {
    const adminClient = getSupabaseAdminClient()
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = typeof formData.get('folder') === 'string' ? formData.get('folder') as string : 'featured'

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' },
        },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'File too large. Maximum size is 5MB.' } },
        { status: 400 }
      )
    }

    const safeFolder = folder.replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'featured'
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await adminClient.storage.from(BUCKET).upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

    if (uploadError) {
      console.error('[API blog/upload-image]', uploadError)
      return NextResponse.json(
        { success: false, error: { code: 'UPLOAD_ERROR', message: 'Failed to upload image' } },
        { status: 500 }
      )
    }

    const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      data: { url: urlData.publicUrl, path: filePath },
    })
  } catch (error) {
    console.error('[API blog/upload-image]', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleUpload, { requiredRole: 'admin' })
