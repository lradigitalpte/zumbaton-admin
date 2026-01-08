/**
 * Reset Password API Route
 * POST /api/users/[userId]/reset-password - Reset user password (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { createAuditLog } from '@/services/rbac.service'
import { z } from 'zod'

type RouteParams = { userId: string }

const ResetPasswordRequestSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/**
 * POST /api/users/[userId]/reset-password - Reset user password
 * Admin only - requires edit_all permission
 */
async function handleResetPassword(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const params = await context.params
    const { userId } = params

    // Parse request body
    const body = await request.json()
    const parseResult = ResetPasswordRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const { password } = parseResult.data

    // Update user password using Supabase Admin API
    const supabaseAdmin = getSupabaseAdminClient()
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: password,
    })

    if (updateError) {
      console.error('Error resetting password:', updateError)
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Failed to reset password' },
        { status: 500 }
      )
    }

    // Log the action
    await createAuditLog({
      userId: context.user.id,
      action: 'user.password.reset',
      resourceType: 'users',
      resourceId: userId,
      newValues: { passwordReset: true },
    })

    // Send email notification to user
    try {
      const { data: userProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('email, name')
        .eq('id', userId)
        .single()

      const { data: adminProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('name')
        .eq('id', context.user.id)
        .single()

      if (userProfile?.email && userProfile?.name) {
        const webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL || 'http://localhost:3000'
        const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'

        await fetch(`${webAppUrl}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'password-reset',
            secret: emailApiSecret,
            data: {
              userEmail: userProfile.email,
              userName: userProfile.name,
              newPassword: password,
              resetBy: adminProfile?.name,
            },
          }),
        })
        console.log(`[PasswordReset] Password reset email sent to ${userProfile.email}`)
      }
    } catch (emailError) {
      console.error('[PasswordReset] Failed to send password reset email:', emailError)
      // Don't fail password reset if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to reset password' },
      { status: 500 }
    )
  }
}

// Export handler with admin auth protection
export const POST = withAuth(handleResetPassword, {
  requiredPermission: {
    resource: 'users',
    action: 'edit_all',
  },
})

