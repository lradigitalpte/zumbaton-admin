/**
 * Streak Reminder Preview API Route
 * GET /api/streak-reminders/preview?name=&streakWeeks= - Rendered email HTML, nothing is sent
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/middleware/rbac'
import { previewStreakReminderEmail } from '@/services/streak-reminders.service'

async function handlePreview(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')?.trim() || 'Alex'
    const streakWeeks = Math.max(1, Math.floor(Number(searchParams.get('streakWeeks')) || 4))

    const preview = await previewStreakReminderEmail({ name, streakWeeks })

    return NextResponse.json({ success: true, data: preview })
  } catch (error) {
    console.error('[API /streak-reminders/preview]', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to render preview',
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handlePreview, { requiredRole: 'admin' })
