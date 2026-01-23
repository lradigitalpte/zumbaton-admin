/**
 * Send Birthday Email API Route
 * POST /api/users/birthdays/send - Send birthday email to a user
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { z } from 'zod'

const SendBirthdayEmailSchema = z.object({
  userId: z.string().uuid(),
})

/**
 * POST /api/users/birthdays/send - Send birthday email to a user
 */
async function handleSendBirthdayEmail(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const body = await request.json()
    const parseResult = SendBirthdayEmailSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parseResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { userId } = parseResult.data
    const adminClient = getSupabaseAdminClient()

    // Get user profile with birthday
    const { data: userProfile, error: userError } = await adminClient
      .from('user_profiles')
      .select('id, email, name, date_of_birth')
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

    if (!userProfile.date_of_birth) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_BIRTHDAY',
            message: 'User does not have a birthday date set',
          },
        },
        { status: 400 }
      )
    }

    // Calculate age
    const birthDate = new Date(userProfile.date_of_birth)
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    const dayDiff = today.getDate() - birthDate.getDate()
    const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age

    // Send email via web app email API
    const { getWebAppUrl } = await import('@/lib/email-url')
    const webAppUrl = getWebAppUrl()
    const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'

    try {
      const response = await fetch(`${webAppUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'birthday',
          secret: emailApiSecret,
          data: {
            userEmail: userProfile.email,
            userName: userProfile.name,
            age: actualAge,
          },
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`[API /users/birthdays/send] Email API error:`, errorBody)
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
        message: 'Birthday email sent successfully',
        messageId: result.messageId,
        userEmail: userProfile.email,
      })
    } catch (fetchError: any) {
      console.error(`[API /users/birthdays/send] Fetch error:`, fetchError)
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
    console.error('[API /users/birthdays/send]', error)
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

export const POST = withAuth(handleSendBirthdayEmail, { requiredRole: 'admin' })
