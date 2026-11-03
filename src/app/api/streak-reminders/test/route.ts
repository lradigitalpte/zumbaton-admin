/**
 * Streak Reminder Test Send API Route
 * POST /api/streak-reminders/test - Send the streak reminder to the signed-in admin (or a given address).
 * Does not mark anyone as reminded, so the real Friday run is unaffected.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { sendStreakReminderEmail } from '@/services/streak-reminders.service'

const TestSendSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().trim().min(1).optional(),
  streakWeeks: z.number().int().positive().max(520).optional(),
})

async function handleTestSend(
  request: NextRequest,
  context: { params: Promise<Record<string, never>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  const parsed = TestSendSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Check the email address and streak weeks' } },
      { status: 400 }
    )
  }

  const { data: profile } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('name')
    .eq('id', context.user.id)
    .maybeSingle()

  const email = parsed.data.email || context.user.email
  const name = parsed.data.name || profile?.name || 'there'
  const streakWeeks = parsed.data.streakWeeks ?? 4

  const result = await sendStreakReminderEmail({ email, name, streakWeeks })
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: { code: 'EMAIL_FAILED', message: result.error || 'Email failed to send' } },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true, data: { email, name, streakWeeks } })
}

export const POST = withAuth(handleTestSend, { requiredRole: 'admin' })
