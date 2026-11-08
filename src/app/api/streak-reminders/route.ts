/**
 * Streak Reminders API Route
 * GET /api/streak-reminders?week=YYYY-MM-DD - Who got the week streak reminder, and who is still due
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/middleware/rbac'
import { addDaysToDateString, singaporeWeekStart } from '@/lib/week-streak'
import {
  getStreakEmailTracking,
  getStreakReminderAudience,
  getStreakReminderRecipients,
} from '@/services/streak-reminders.service'

const WEEKS_SHOWN = 8

async function handleGetStreakReminders(request: NextRequest): Promise<NextResponse> {
  try {
    const currentWeek = singaporeWeekStart(new Date())
    const weeks = Array.from({ length: WEEKS_SHOWN }, (_, i) => addDaysToDateString(currentWeek, -7 * i))

    const requested = new URL(request.url).searchParams.get('week')
    const week = requested && weeks.includes(requested) ? requested : currentWeek

    const [recipients, audience, tracking] = await Promise.all([
      getStreakReminderRecipients(week),
      week === currentWeek ? getStreakReminderAudience() : Promise.resolve(null),
      getStreakEmailTracking(week),
    ])

    // Tracked sends are the accurate record (real sent time, and they survive later
    // weeks' reminders). Merge in anyone the tracking log has that the legacy
    // last-reminder-week field no longer shows.
    const trackedSentAt = new Map(tracking.map((t) => [t.userId, t.sentAt]))
    const merged = recipients.map((r) => ({ ...r, sentAt: trackedSentAt.get(r.userId) ?? r.sentAt }))
    for (const t of tracking) {
      if (!merged.some((r) => r.userId === t.userId)) {
        merged.push({ userId: t.userId, name: t.name, email: t.email, streakWeeks: t.streakWeeks, sentAt: t.sentAt })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        week,
        currentWeek,
        weeks,
        recipients: merged,
        members: audience?.members ?? null,
        tracking,
      },
    })
  } catch (error) {
    console.error('[API /streak-reminders]', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to load streak reminders',
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetStreakReminders, { requiredRole: 'admin' })
