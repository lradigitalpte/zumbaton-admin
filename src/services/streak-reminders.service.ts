// Week streak reminder audience and email helpers.
// Shared by the Friday cron job and the admin streak reminders page.

import { getSupabaseAdminClient } from '@/lib/supabase'
import { getWebAppUrl } from '@/lib/email-url'
import { addDaysToDateString, singaporeWeekBounds } from '@/lib/week-streak'

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

// ---------------------------------------------------------------------------
// Per-email tracking (email_sends table: migration 20261108_create_email_sends)
// ---------------------------------------------------------------------------

export const STREAK_EMAIL_KIND = 'streak_reminder'

/**
 * Log a streak reminder before it is sent; the row id becomes the tracking token
 * in the email. Returns null if the table isn't there yet, so sending still works.
 */
export async function createStreakEmailSend(params: {
  userId: string
  email: string
  weekStart: string
  streakWeeks: number
}): Promise<string | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from('email_sends')
    .insert({
      kind: STREAK_EMAIL_KIND,
      user_id: params.userId,
      email: params.email,
      week_start: params.weekStart,
      meta: { streak_weeks: params.streakWeeks },
      status: 'sending',
    })
    .select('id')
    .single()
  if (error) {
    console.warn('[StreakReminders] email_sends not recorded (tracking off for this email):', error.message)
    return null
  }
  return data.id as string
}

export async function finishStreakEmailSend(id: string | null, result: { success: boolean; error?: string }) {
  if (!id) return
  const { error } = await getSupabaseAdminClient()
    .from('email_sends')
    .update(
      result.success
        ? { status: 'sent', sent_at: new Date().toISOString() }
        : { status: 'failed', error: result.error?.slice(0, 500) ?? 'Unknown error' }
    )
    .eq('id', id)
  if (error) console.error('[StreakReminders] Failed to update email_sends row', id, error.message)
}

export interface StreakEmailTracking {
  userId: string
  name: string | null
  email: string | null
  streakWeeks: number
  sentAt: string
  openedAt: string | null
  openCount: number
  clickedAt: string | null
  clickCount: number
  /** First booking made after the email for a class in that week (confirmed or attended). */
  bookedAfterAt: string | null
  /** Attended a class that week after the email went out. */
  attended: boolean
  /** First successful token purchase within 7 days after the email. */
  boughtAt: string | null
  boughtCents: number
  boughtPackage: string | null
}

const PURCHASE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Who opened / clicked / booked after this week's reminder — one row per member emailed,
 * from the email_sends log. Empty if no tracked emails exist for the week.
 */
export async function getStreakEmailTracking(weekStart: string): Promise<StreakEmailTracking[]> {
  const admin = getSupabaseAdminClient()
  const { data: sends, error } = await admin
    .from('email_sends')
    .select('user_id, email, meta, sent_at, opened_at, open_count, clicked_at, click_count')
    .eq('kind', STREAK_EMAIL_KIND)
    .eq('week_start', weekStart)
    .eq('status', 'sent')
    .order('sent_at', { ascending: true })

  if (error) {
    // Table not created yet → no tracking data, not an error for the page.
    console.warn('[StreakReminders] email_sends unavailable:', error.message)
    return []
  }

  // Keep the first send per member for the week.
  const byUser = new Map<string, NonNullable<typeof sends>[number]>()
  for (const row of sends || []) {
    if (row.user_id && !byUser.has(row.user_id)) byUser.set(row.user_id, row)
  }
  const userIds = [...byUser.keys()]
  if (userIds.length === 0) return []

  const weekEnd = addDaysToDateString(weekStart, 7)
  const startIso = `${weekStart}T00:00:00+08:00`
  const endIso = `${weekEnd}T00:00:00+08:00`

  const profiles = new Map<string, { name: string | null; email: string | null }>()
  const bookedAfter = new Map<string, string>()
  const attended = new Set<string>()
  const bought = new Map<string, { at: string; cents: number; pkg: string | null }>()

  const sentTimes = userIds.map((uid) => byUser.get(uid)?.sent_at as string).filter(Boolean).sort()
  const earliestSent = sentTimes[0]

  for (const ids of chunkIds(userIds)) {
    // Token purchases in the 7 days after each member's email.
    if (earliestSent) {
      const { data: payments, error: paymentError } = await admin
        .from('payments')
        .select('user_id, amount_cents, created_at, metadata')
        .in('user_id', ids)
        .eq('status', 'succeeded')
        .gt('created_at', earliestSent)
        .order('created_at', { ascending: true })
      if (paymentError) {
        console.error('[StreakReminders] Failed to load purchases for tracking:', paymentError.message)
      }
      for (const p of payments || []) {
        const uid = p.user_id as string
        const sentAt = byUser.get(uid)?.sent_at as string | undefined
        if (!sentAt || bought.has(uid)) continue
        const t = new Date(p.created_at as string).getTime()
        const s = new Date(sentAt).getTime()
        if (t <= s || t - s > PURCHASE_WINDOW_MS) continue
        const meta = (p.metadata || {}) as { package_name?: string }
        bought.set(uid, { at: p.created_at as string, cents: Number(p.amount_cents) || 0, pkg: meta.package_name ?? null })
      }
    }

    const { data: profileRows } = await admin.from('user_profiles').select('id, name, email').in('id', ids)
    for (const p of profileRows || []) profiles.set(p.id, { name: p.name ?? null, email: p.email ?? null })

    const { data: bookings, error: bookingError } = await admin
      .from('bookings')
      .select('user_id, status, created_at, classes!inner(scheduled_at)')
      .in('user_id', ids)
      .in('status', ['confirmed', 'attended'])
      .gte('classes.scheduled_at', startIso)
      .lt('classes.scheduled_at', endIso)
    if (bookingError) {
      console.error('[StreakReminders] Failed to load bookings for tracking:', bookingError.message)
      continue
    }

    for (const b of bookings || []) {
      const uid = b.user_id as string
      const sentAt = byUser.get(uid)?.sent_at as string | undefined
      if (!sentAt || !b.created_at || (b.created_at as string) <= sentAt) continue
      const prev = bookedAfter.get(uid)
      if (!prev || (b.created_at as string) < prev) bookedAfter.set(uid, b.created_at as string)
      if (b.status === 'attended') attended.add(uid)
    }
  }

  return userIds.map((uid) => {
    const row = byUser.get(uid)!
    const profile = profiles.get(uid)
    const meta = (row.meta || {}) as { streak_weeks?: number }
    return {
      userId: uid,
      name: profile?.name ?? null,
      email: profile?.email ?? (row.email as string | null) ?? null,
      streakWeeks: Number(meta.streak_weeks) || 0,
      sentAt: row.sent_at as string,
      openedAt: (row.opened_at as string | null) ?? null,
      openCount: Number(row.open_count) || 0,
      clickedAt: (row.clicked_at as string | null) ?? null,
      clickCount: Number(row.click_count) || 0,
      bookedAfterAt: bookedAfter.get(uid) ?? null,
      attended: attended.has(uid),
      boughtAt: bought.get(uid)?.at ?? null,
      boughtCents: bought.get(uid)?.cents ?? 0,
      boughtPackage: bought.get(uid)?.pkg ?? null,
    }
  })
}

/** Posts one streak reminder to the web app's email API. Does not record the dedupe week. */
export async function sendStreakReminderEmail(params: {
  email: string
  name: string
  streakWeeks: number
  /** email_sends.id — turns on open/click tracking in the email. */
  trackingId?: string | null
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
          ...(params.trackingId ? { trackingId: params.trackingId } : {}),
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
