/**
 * Send Welcome Email API Route
 * POST /api/users/[userId]/send-welcome-email - Send welcome email to newly created user
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

/**
 * POST /api/users/[userId]/send-welcome-email - Send welcome email
 */
async function handleSendWelcomeEmail(
  request: NextRequest,
  context: { params: Promise<{ userId: string }>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params
    const body = await request.json().catch(() => ({}))
    const temporaryPassword = body.temporaryPassword as string | undefined
    
    const adminClient = getSupabaseAdminClient()

    // Get user profile
    const { data: userProfile, error: userError } = await adminClient
      .from('user_profiles')
      .select('id, email, name, role')
      .eq('id', userId)
      .single()

    if (userError || !userProfile) {
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

    // Get admin name who created the user
    const { data: adminProfile } = await adminClient
      .from('user_profiles')
      .select('name')
      .eq('id', context.user.id)
      .single()

    // Send email via web app email API
    const { getWebAppUrl } = await import('@/lib/email-url')
    const webAppUrl = getWebAppUrl()
    const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'

    try {
      const response = await fetch(`${webAppUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'admin-created-user',
          secret: emailApiSecret,
          data: {
            userEmail: userProfile.email,
            userName: userProfile.name,
            temporaryPassword: temporaryPassword,
            createdBy: adminProfile?.name || 'Admin',
          },
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`[API /users/${userId}/send-welcome-email] Email API error:`, errorBody)
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'EMAIL_ERROR',
              message: `Failed to send email: ${response.status}`,
            },
          },
          { status: 500 }
        )
      }

      const result = await response.json()
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'EMAIL_ERROR',
              message: result.error || 'Failed to send email',
            },
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Welcome email sent successfully',
        messageId: result.messageId,
      })
    } catch (fetchError: any) {
      console.error(`[API /users/${userId}/send-welcome-email] Fetch error:`, fetchError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_ERROR',
            message: fetchError.message || 'Failed to connect to email service',
          },
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API /users/[userId]/send-welcome-email]', error)
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

export const POST = withAuth(handleSendWelcomeEmail, { requiredRole: 'admin' })
