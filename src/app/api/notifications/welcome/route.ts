// Welcome Notification API Route
// Sends welcome notification to new users after signup

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNotification } from '@/services/notification.service'
import { getSupabaseAdminClient } from '@/lib/supabase'

const WelcomeNotificationSchema = z.object({
  userId: z.string().uuid(),
})

// POST /api/notifications/welcome - Send welcome notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = WelcomeNotificationSchema.parse(body)

    // Get user profile
    const adminClient = getSupabaseAdminClient()
    const { data: userProfile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('name, email, created_at')
      .eq('id', userId)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND_ERROR',
          message: 'User not found',
        },
      }, { status: 404 })
    }

    // Check if welcome notification was already sent (prevent duplicates)
    const { data: existingNotification } = await adminClient
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'welcome')
      .maybeSingle()

    if (existingNotification) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'Welcome notification already sent',
          alreadySent: true,
        },
      })
    }

    // Send welcome notification
    await sendNotification({
      userId,
      type: 'welcome',
      channel: 'in_app',
      data: {
        user_name: userProfile.name || 'User',
        message: `Welcome to Zumbaton, ${userProfile.name || 'User'}! We're excited to have you. Start exploring classes and book your first session!`,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'Welcome notification sent',
        alreadySent: false,
      },
    })
  } catch (error) {
    console.error('[API /notifications/welcome]', error)

    if (error && typeof error === 'object' && 'errors' in error) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: (error as { errors: unknown[] }).errors,
        },
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to send welcome notification',
      },
    }, { status: 500 })
  }
}
