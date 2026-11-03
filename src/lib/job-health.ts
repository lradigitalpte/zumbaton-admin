import { AsyncLocalStorage } from 'async_hooks'
import { getSupabaseAdminClient } from '@/lib/supabase'

export type JobRunSource = 'scheduled' | 'desk'
export type JobHealthStatus = 'on_time' | 'late' | 'attention' | 'waiting'

const sourceStore = new AsyncLocalStorage<JobRunSource>()

export function withCronSource<T>(source: JobRunSource, fn: () => Promise<T>): Promise<T> {
  return sourceStore.run(source, fn)
}

type JobKind = 'interval' | 'daily' | 'friday'

export interface JobHealthDef {
  name: string
  label: string
  group: 'day' | 'morning' | 'friday' | 'hour' | 'night'
  hint: string
  kind: JobKind
  /** How long a quiet stretch can be before the row is late. */
  lateAfterMinutes: number
}

export const JOB_HEALTH: JobHealthDef[] = [
  { name: 'sendClassReminders', label: 'Class reminders', group: 'day', hint: 'Classes starting in about an hour', kind: 'interval', lateAfterMinutes: 45 },
  { name: 'processExpiredWaitlistNotifications', label: 'Waitlist offers', group: 'day', hint: 'Offers that have been waiting', kind: 'interval', lateAfterMinutes: 45 },
  { name: 'syncPendingHitPayPayments', label: 'Payment check', group: 'day', hint: 'Payments waiting to be confirmed', kind: 'interval', lateAfterMinutes: 45 },
  { name: 'sendCheckoutReminders', label: 'Checkout reminders', group: 'day', hint: 'People who started checkout and have not paid', kind: 'interval', lateAfterMinutes: 45 },
  { name: 'processLeadOutreachQueue', label: 'Lead follow-ups', group: 'day', hint: 'Emails and WhatsApp notes waiting to go out', kind: 'interval', lateAfterMinutes: 12 },
  { name: 'sendBirthdayWishes', label: 'Birthday wishes', group: 'morning', hint: 'Members whose birthday is today', kind: 'daily', lateAfterMinutes: 26 * 60 },
  { name: 'sendTokenExpiryWarnings', label: 'Token expiry warnings', group: 'morning', hint: 'Packages ending in 3 days', kind: 'daily', lateAfterMinutes: 26 * 60 },
  { name: 'sendTokenBalanceLowWarnings', label: 'Low token balance', group: 'morning', hint: 'Balances under 3 tokens', kind: 'daily', lateAfterMinutes: 26 * 60 },
  { name: 'sendStreakReminders', label: 'Week streak reminders', group: 'friday', hint: 'Friday morning, for streaks that would end on Sunday', kind: 'friday', lateAfterMinutes: 8 * 24 * 60 },
  { name: 'processCompletedBookings', label: 'Mark classes attended', group: 'hour', hint: 'Bookings after class has ended', kind: 'interval', lateAfterMinutes: 150 },
  { name: 'markCompletedClasses', label: 'Mark completed classes', group: 'night', hint: 'Classes whose time has passed', kind: 'daily', lateAfterMinutes: 26 * 60 },
  { name: 'autoGenerateFutureClasses', label: 'Future class dates', group: 'night', hint: 'Keeps the recurring schedule filled in', kind: 'daily', lateAfterMinutes: 26 * 60 },
  { name: 'processExpiredPackages', label: 'Expire packages', group: 'night', hint: 'Packages past their end date', kind: 'daily', lateAfterMinutes: 26 * 60 },
  { name: 'processFrozenPackages', label: 'Unfreeze packages', group: 'night', hint: 'Freezes that have reached their end', kind: 'daily', lateAfterMinutes: 26 * 60 },
]

export const JOB_HEALTH_GROUPS: { id: JobHealthDef['group']; label: string }[] = [
  { id: 'day', label: 'Through the day' },
  { id: 'morning', label: 'Each morning' },
  { id: 'friday', label: 'Friday' },
  { id: 'hour', label: 'Each hour' },
  { id: 'night', label: 'Overnight' },
]

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length
  return asNumber(value)
}

export function summarizeJobRun(details: Record<string, unknown>, error?: string): { summary: string; needsAttention: boolean } {
  if (error) {
    const clean = error.replace(/\s+/g, ' ').trim()
    return { summary: clean.length > 0 && clean.length < 140 ? clean : 'Did not finish', needsAttention: true }
  }

  const sent = asNumber(details.sent)
  const skipped = asNumber(details.skipped)
  const failed = asCount(details.failed)
  const synced = asNumber(details.synced)
  const processed = asNumber(details.processed)
  const expired = asNumber(details.expired)
  const unfrozen = asNumber(details.unfrozen)
  const classesMarked = asNumber(details.classesMarked)
  const generated = asNumber(details.totalGenerated)
  const parts: string[] = []

  if (sent != null) parts.push(sent === 0 ? 'Nothing to send' : `${sent} sent`)
  else if (synced != null) parts.push(synced === 0 ? 'Nothing to confirm' : `${synced} confirmed`)
  else if (classesMarked != null) parts.push(classesMarked === 0 ? 'None to close' : `${classesMarked} closed`)
  else if (generated != null) parts.push(generated === 0 ? 'Schedule already filled' : `${generated} dates added`)
  else if (expired != null) parts.push(expired === 0 ? 'None to expire' : `${expired} expired`)
  else if (unfrozen != null) parts.push(unfrozen === 0 ? 'None to unfreeze' : `${unfrozen} unfrozen`)
  else if (processed != null) parts.push(processed === 0 ? 'Nothing to do' : `${processed} handled`)

  if (skipped != null && skipped > 0 && (sent != null || synced != null)) parts.push(`${skipped} skipped`)

  const needsAttention = details.success === false || (failed ?? 0) > 0
  if ((failed ?? 0) > 0) parts.push(`${failed} need a look`)
  if (needsAttention && parts.length === 0) parts.push('Needs a look')

  return {
    summary: parts.length > 0 ? parts.join(' · ') : 'Finished',
    needsAttention,
  }
}

export async function recordJobRun(input: {
  jobName: string
  success: boolean
  durationMs: number
  details: Record<string, unknown>
  error?: string
}): Promise<void> {
  try {
    const { summary, needsAttention } = summarizeJobRun(input.details, input.error)
    const admin = getSupabaseAdminClient()
    const { error } = await admin.from('cron_job_runs').insert({
      job_name: input.jobName,
      success: input.success,
      needs_attention: !input.success || needsAttention,
      duration_ms: input.durationMs,
      summary,
      source: sourceStore.getStore() ?? 'desk',
    })
    if (error) {
      console.error('[JobHealth] Could not save run note', error.message)
      return
    }

    const { data: older } = await admin
      .from('cron_job_runs')
      .select('ran_at')
      .eq('job_name', input.jobName)
      .order('ran_at', { ascending: false })
      .range(60, 60)
    const cutoff = older?.[0]?.ran_at
    if (cutoff) {
      await admin.from('cron_job_runs').delete().eq('job_name', input.jobName).lt('ran_at', cutoff)
    }
  } catch (err) {
    console.error('[JobHealth] Could not save run note', err)
  }
}

interface RunRow {
  job_name: string
  success: boolean
  needs_attention: boolean
  duration_ms: number
  summary: string
  source: string
  ran_at: string
}

function sgtParts(now: Date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]))
}

/** Friday 9:00am Singapore we should already have a run for. Before 9:45am, that is last Friday. */
function streakExpectedAt(now: Date): Date {
  const parts = sgtParts(now)
  const weekday: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dow = weekday[parts.weekday] ?? 0
  const daysBack = (dow + 2) % 7
  const nine = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    9 - 8,
    0,
    0,
  ))
  nine.setUTCDate(nine.getUTCDate() - daysBack)
  if (now.getTime() < nine.getTime() + 45 * 60 * 1000) {
    nine.setUTCDate(nine.getUTCDate() - 7)
  }
  return nine
}

function statusFor(def: JobHealthDef, latest: RunRow | undefined, now: Date): JobHealthStatus {
  if (!latest) return 'waiting'
  if (!latest.success || latest.needs_attention) return 'attention'
  const ranAt = new Date(latest.ran_at).getTime()
  if (def.kind === 'friday') {
    return ranAt >= streakExpectedAt(now).getTime() ? 'on_time' : 'late'
  }
  const ageMinutes = (now.getTime() - ranAt) / 60000
  return ageMinutes <= def.lateAfterMinutes ? 'on_time' : 'late'
}

export interface JobHealthRow {
  name: string
  label: string
  group: JobHealthDef['group']
  hint: string
  status: JobHealthStatus
  summary: string | null
  ranAt: string | null
  durationMs: number | null
  source: string | null
}

export async function getJobHealth(now = new Date()): Promise<{ ready: boolean; jobs: JobHealthRow[] }> {
  const admin = getSupabaseAdminClient()
  const results = await Promise.all(
    JOB_HEALTH.map((def) =>
      admin
        .from('cron_job_runs')
        .select('job_name, success, needs_attention, duration_ms, summary, source, ran_at')
        .eq('job_name', def.name)
        .order('ran_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  )

  const missing = results.find((result) => result.error && (result.error.code === '42P01' || /cron_job_runs/i.test(result.error.message)))
  if (missing) return { ready: false, jobs: [] }
  const failed = results.find((result) => result.error)
  if (failed?.error) throw new Error(failed.error.message)

  const latest = new Map<string, RunRow>()
  for (const result of results) {
    const row = result.data as RunRow | null
    if (row) latest.set(row.job_name, row)
  }

  return {
    ready: true,
    jobs: JOB_HEALTH.map((def) => {
      const row = latest.get(def.name)
      return {
        name: def.name,
        label: def.label,
        group: def.group,
        hint: def.hint,
        status: statusFor(def, row, now),
        summary: row?.summary ?? null,
        ranAt: row?.ran_at ?? null,
        durationMs: row?.duration_ms ?? null,
        source: row?.source ?? null,
      }
    }),
  }
}
