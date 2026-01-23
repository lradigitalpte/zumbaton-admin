/**
 * Physical Form Management API Route
 * PUT /api/users/[userId]/physical-form - Update physical form URL
 * DELETE /api/users/[userId]/physical-form - Delete physical form
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

type RouteParams = { userId: string }

/**
 * PUT /api/users/[userId]/physical-form - Update physical form URL
 */
async function handleUpdatePhysicalForm(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params
    const body = await request.json()
    const { physicalFormUrl } = body

    if (!physicalFormUrl || typeof physicalFormUrl !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'physicalFormUrl is required',
          },
        },
        { status: 400 }
      )
    }

    const adminClient = getSupabaseAdminClient()

    // Update user profile with physical form URL
    const { error: updateError } = await adminClient
      .from('user_profiles')
      .update({
        physical_form_url: physicalFormUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error(`[API /users/${userId}/physical-form] Update error:`, updateError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UPDATE_ERROR',
            message: 'Failed to update physical form URL',
          },
        },
        { status: 500 }
      )
    }

    // Invalidate Next.js cache for this user's route
    revalidatePath(`/api/users/${userId}`)
    revalidatePath(`/users/${userId}`)

    return NextResponse.json({
      success: true,
      data: {
        physicalFormUrl,
        message: 'Physical form URL updated successfully',
      },
    })
  } catch (error) {
    console.error('[API /users/[userId]/physical-form]', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[userId]/physical-form - Delete physical form
 */
async function handleDeletePhysicalForm(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params
    const adminClient = getSupabaseAdminClient()

    // Get current physical form URL
    const { data: userProfile, error: fetchError } = await adminClient
      .from('user_profiles')
      .select('physical_form_url')
      .eq('id', userId)
      .single()

    if (fetchError || !userProfile) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      )
    }

    const physicalFormUrl = userProfile.physical_form_url

    // If there's a physical form URL, try to delete the file from storage
    if (physicalFormUrl) {
      try {
        // Extract bucket and path from URL
        // URLs are typically: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
        const urlParts = physicalFormUrl.split('/storage/v1/object/public/')
        if (urlParts.length === 2) {
          const [bucket, ...pathParts] = urlParts[1].split('/')
          const filePath = pathParts.join('/')

          // Try to delete from documents bucket first, then avatars
          const buckets = ['documents', 'avatars']
          for (const bucketName of buckets) {
            const { error: deleteError } = await adminClient.storage
              .from(bucketName)
              .remove([filePath])

            if (!deleteError) {
              console.log(`[API /users/${userId}/physical-form] Deleted file from ${bucketName} bucket`)
              break
            } else if (deleteError.message && !deleteError.message.includes('not found')) {
              console.error(`[API /users/${userId}/physical-form] Error deleting from ${bucketName}:`, deleteError)
            }
          }
        }
      } catch (deleteError) {
        // Log but don't fail - the file might not exist or URL format might be different
        console.warn(`[API /users/${userId}/physical-form] Could not delete file from storage:`, deleteError)
      }
    }

    // Clear physical form URL from user profile
    const { error: updateError } = await adminClient
      .from('user_profiles')
      .update({
        physical_form_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error(`[API /users/${userId}/physical-form] Update error:`, updateError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UPDATE_ERROR',
            message: 'Failed to clear physical form URL',
          },
        },
        { status: 500 }
      )
    }

    // Invalidate Next.js cache for this user's route
    revalidatePath(`/api/users/${userId}`)
    revalidatePath(`/users/${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Physical form deleted successfully',
    })
  } catch (error) {
    console.error('[API /users/[userId]/physical-form]', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    )
  }
}

export const PUT = withAuth(handleUpdatePhysicalForm, { requiredRole: 'admin' })
export const DELETE = withAuth(handleDeletePhysicalForm, { requiredRole: 'admin' })
