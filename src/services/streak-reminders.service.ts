// Week streak reminder audience and email helpers.
// Shared by the Friday cron job and the admin streak reminders page.

import { getSupabaseAdminClient } from '@/lib/supabase'
import { getWebAppUrl } from '@/lib/email-url'
import { singaporeWeekBounds } from '@/lib/week-streak'

export type StreakReminderStatus = 'sent' | 'due' | 'booked' | 'opted_out' | 'no_profile'

export interface StreakReminderMember {
  userId: string
  name: string | null
  email: string | null
  streakWeeks: number
  lastReminderWeek: string | null
  status: StreakReminderStatus
}

export interface StreakReminderAudience {
  weekStart: string
  startIso: string
  endIso: string
  members: StreakReminderMember[]
}

export interface StreakReminderRecipient {
  userId: string
  name: string | null
  email: string | null
  streakWeeks: number
  sentAt: string | null
}

const EMAIL_TIMEOUT_MS = 20_000

function chunkIds(ids: string[], size = 100): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size))
  return chunks
}

function weekOf(value: unknown): string | null {
  return value ? String(value).slice(0, 10) : null
}

export function getStreakBookUrl(): string {
  return `${getWebAppUrl().replace(/\/$/, '')}/book-classes`
}

/** Every member with a live week streak, and whether this week's reminder applies to them. */
export async function getStreakReminderAudience(now: Date = new Date()): Promise<StreakReminderAudience> {
  const admin = getSupabaseAdminClient()
  const { weekStart, startIso, endIso } = singaporeWeekBounds(now)

  const { data: statsRows, error: statsError } = await admin
    .from('user_stats')
    .select('user_id, streak_current, last_streak_reminder_week')
    .gt('streak_current', 0)

  if (statsError) {
    throw new Error(`Failed to load streaks: ${statsError.message}`)
  }

  const rows = statsRows || []
  const userIds = rows.map((row) => row.user_id as string)

  const profiles = new Map<string, { email: string | null; name: string | null; isActive: boolean }>()
  const optedOut = new Set<string>()
  const booked = new Set<string>()

  for (const ids of chunkIds(userIds)) {
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, email, name, is_active')
      .in('id', ids)

    if (error) throw new Error(`Failed to load members: ${error.message}`)

    for (const profile of data || []) {
      profiles.set(profile.id, {
        email: profile.email ?? null,
        name: profile.name ?? null,
        isActive: profile.is_active !== false,
      })
    }
  }

  for (const ids of chunkIds(userIds)) {
    const { data, error } = await admin
      .from('user_notification_preferences')
      .select('user_id, email_enabled')
      .in('user_id', ids)

    if (error) throw new Error(`Failed to load email preferences: ${error.message}`)

    for (const pref of data || []) {
      if (pref.email_enabled === false) optedOut.add(pref.user_id)
    }
  }

  for (const ids of chunkIds(userIds)) {
    const { data: bookings, error: bookingError } = await admin
      .from('bookings')
      .select('user_id, classes!inner(scheduled_at)')
      .in('user_id', ids)
      .in('status', ['attended', 'confirmed'])
      .gte('classes.scheduled_at', startIso)
      .lt('classes.scheduled_at', endIso)

    if (bookingError) {
      throw new Error(`Failed to load this week's bookings: ${bookingError.message}`)
    }

    for (const booking of bookings || []) {
      if (booking.user_id) booked.add(booking.user_id as string)
    }
  }

  const members: StreakReminderMember[] = rows.map((row) => {
    const userId = row.user_id as string
    const profile = profiles.get(userId)
    const lastReminderWeek = weekOf(row.last_streak_reminder_week)

    let status: StreakReminderStatus
    if (lastReminderWeek && lastReminderWeek >= weekStart) status = 'sent'
    else if (!profile || !profile.isActive || !profile.email || !profile.name) status = 'no_profile'
    else if (optedOut.has(userId)) status = 'opted_out'
    else if (booked.has(userId)) status = 'booked'
    else status = 'due'

    return {
      userId,
      name: profile?.name ?? null,
      email: profile?.email ?? null,
      streakWeeks: row.streak_current as number,
      lastReminderWeek,
      status,
    }
  })

  return { weekStart, startIso, endIso, members }
}

/**
 * Members whose latest reminder was for `weekStart`.
 * Only the latest reminder week is stored per member, so older weeks lose
 * anyone who has been reminded again since.
 */
export async function getStreakReminderRecipients(weekStart: string): Promise<StreakReminderRecipient[]> {
  const admin = getSupabaseAdminClient()

  const { data: rows, error } = await admin
    .from('user_stats')
    .select('user_id, streak_current, last_streak_reminder_week, updated_at')
    .eq('last_streak_reminder_week', weekStart)

  if (error) throw new Error(`Failed to load reminder recipients: ${error.message}`)

  const userIds = (rows || []).map((row) => row.user_id as string)
  const profiles = new Map<string, { email: string | null; name: string | null }>()
  for (const ids of chunkIds(userIds)) {
    const { data, error: profileError } = await admin
      .from('user_profiles')
      .select('id, email, name')
      .in('id', ids)

    if (profileError) throw new Error(`Failed to load members: ${profileError.message}`)
    for (const profile of data || []) {
      profiles.set(profile.id, { email: profile.email ?? null, name: profile.name ?? null })
    }
  }

  return (rows || [])
    .map((row) => {
      const profile = profiles.get(row.user_id as string)
      return {
        userId: row.user_id as string,
        name: profile?.name ?? null,
        email: profile?.email ?? null,
        streakWeeks: row.streak_current as number,
        sentAt: (row.updated_at as string | null) ?? null,
      }
    })
    .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''))
}

/** Posts one streak reminder to the web app's email API. Does not record the dedupe week. */
export async function sendStreakReminderEmail(params: {
  email: string
  name: string
  streakWeeks: number
}): Promise<{ success: boolean; error?: string }> {
  const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'
  const emailUrl = `${getWebAppUrl().replace(/\/$/, '')}/api/email/send`

  try {
    const response = await fetch(emailUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      body: JSON.stringify({
        type: 'streak-reminder',
        secret: emailApiSecret,
        data: {
          userEmail: params.email,
          userName: params.name,
          streakWeeks: params.streakWeeks,
          bookUrl: getStreakBookUrl(),
        },
      }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.success) {
      return { success: false, error: body?.error || `Email API returned ${response.status}` }
    }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'fetch failed') {
      return { success: false, error: `Couldn't reach the member site at ${emailUrl.replace(/\/api\/email\/send$/, '')}` }
    }
    return { success: false, error: message }
  }
}

/** Renders the streak reminder email without sending it. */
export async function previewStreakReminderEmail(params: {
  name: string
  streakWeeks: number
}): Promise<{ subject: string; html: string }> {
  const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'
  const webAppUrl = getWebAppUrl().replace(/\/$/, '')

  let response: Response
  try {
    response = await fetch(`${webAppUrl}/api/email/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      body: JSON.stringify({
        type: 'streak-reminder',
        secret: emailApiSecret,
        data: {
          userName: params.name,
          streakWeeks: params.streakWeeks,
          bookUrl: getStreakBookUrl(),
        },
      }),
    })
  } catch {
    throw new Error(`Couldn't reach the member site at ${webAppUrl}. Check it's running and NEXT_PUBLIC_WEB_APP_URL is right.`)
  }

  if (response.status === 404) {
    throw new Error(`The member site at ${webAppUrl} doesn't have the preview yet. Deploy the latest zumbaton-web.`)
  }
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `Email preview returned ${response.status}`)
  }
  return { subject: body.subject, html: body.html }
}
