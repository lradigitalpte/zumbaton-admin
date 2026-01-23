/**
 * Resend Welcome Email API Route
 * POST /api/users/[userId]/resend-email - Resend welcome email with new password
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

/**
 * Generate a secure random password (8 characters)
 */
function generatePassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const special = '!@#$%^&*'
  
  const allChars = lowercase + uppercase + numbers + special
  let password = ''
  
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]
  
  // Fill the rest randomly to make it 8 characters total
  for (let i = password.length; i < 8; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

/**
 * POST /api/users/[userId]/resend-email - Resend welcome email with new password
 */
async function handleResendEmail(
  request: NextRequest,
  context: { params: Promise<{ userId: string }>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params
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

    // Generate a new temporary password
    const newPassword = generatePassword()

    // Update the user's password in Supabase Auth (this invalidates the old password)
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      console.error(`[API /users/${userId}/resend-email] Password update error:`, updateError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PASSWORD_UPDATE_ERROR',
            message: 'Failed to update password',
          },
        },
        { status: 500 }
      )
    }

    // Get admin name who is resending the email
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
            temporaryPassword: newPassword, // Include new password
            createdBy: adminProfile?.name || 'Admin',
          },
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`[API /users/${userId}/resend-email] Email API error:`, errorBody)
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
        message: 'Welcome email resent successfully with new password',
        messageId: result.messageId,
        userEmail: userProfile.email,
      })
    } catch (fetchError: any) {
      console.error(`[API /users/${userId}/resend-email] Fetch error:`, fetchError)
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
    console.error('[API /users/[userId]/resend-email]', error)
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

export const POST = withAuth(handleResendEmail, { requiredRole: 'admin' })
