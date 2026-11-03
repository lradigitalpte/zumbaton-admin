import { getSupabaseAdminClient } from '@/lib/supabase'
import { getWebAppUrl } from '@/lib/email-url'
import { startOfSgtDay } from '@/lib/reports-utils'

export type ServiceStatus = 'up' | 'slow' | 'down' | 'off'

export interface ServiceHealth {
  id: string
  label: string
  address: string
  status: ServiceStatus
  ms: number | null
  detail: string
}

export interface DatabaseMetrics {
  databaseBytes: number
  connections: number
  activeConnections: number
  maxConnections: number
  cacheHitRatio: number | null
  startedAt: string
  tables: { name: string; rows: number; bytes: number }[]
  storage: { bucket: string; files: number; bytes: number }[]
}

export interface ActivityMetrics {
  members: number
  newMembersToday: number
  bookingsToday: number
  paymentsToday: { paid: number; pending: number; failed: number; amount: number }
  emailsToday: { sent: number; failed: number }
  week: { date: string; bookings: number; paid: number }[]
}

export interface JobMetrics {
  runs: number
  failed: number
  lastRunAt: string | null
}

const TIMEOUT_MS = 8000
const SLOW_MS = 1500

async function timed(url: string, init: RequestInit = {}) {
  const started = Date.now()
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
  return { ok: response.ok, status: response.status, ms: Date.now() - started }
}

function statusFor(answered: boolean, ms: number | null): ServiceStatus {
  if (!answered) return 'down'
  return ms != null && ms > SLOW_MS ? 'slow' : 'up'
}

function host(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

async function checkRecords(): Promise<ServiceHealth> {
  const base = { id: 'records', label: 'Database', address: host(process.env.NEXT_PUBLIC_SUPABASE_URL || 'Supabase') }
  const started = Date.now()
  try {
    const { error } = await getSupabaseAdminClient().from('user_profiles').select('id').limit(1)
    const ms = Date.now() - started
    if (error) return { ...base, status: 'down', ms: null, detail: 'Could not read records' }
    return { ...base, status: statusFor(true, ms), ms, detail: 'Reading records' }
  } catch {
    return { ...base, status: 'down', ms: null, detail: 'Did not answer' }
  }
}

async function checkSite(): Promise<ServiceHealth> {
  const configured = process.env.NEXT_PUBLIC_WEB_URL || ''
  const url = configured && !/localhost|127\.0\.0\.1/.test(configured) ? configured : 'https://onestepfitness.sg'
  const base = { id: 'site', label: 'Member site', address: host(url) }
  try {
    const result = await timed(url)
    const answered = result.status < 500
    return { ...base, status: statusFor(answered, result.ms), ms: answered ? result.ms : null, detail: answered ? 'Pages loading' : 'Site error' }
  } catch {
    return { ...base, status: 'down', ms: null, detail: 'Did not answer' }
  }
}

function productionWebUrl() {
  const url = process.env.NEXT_PUBLIC_WEB_URL || 'https://onestepfitness.sg'
  return url.replace(/\/$/, '')
}

/** Admin never talks to Resend directly — it POSTs to the member site, which sends via Resend. */
async function checkEmail(): Promise<ServiceHealth> {
  const sendUrl = getWebAppUrl().replace(/\/$/, '')
  const localAdmin = /localhost|127\.0\.0\.1/.test(sendUrl)
  const checkUrl = localAdmin ? productionWebUrl() : sendUrl
  const base = {
    id: 'email',
    label: 'Email',
    address: `Resend · ${host(checkUrl)}`,
  }
  try {
    const result = await timed(`${checkUrl}/api/email/send`, { method: 'GET' })
    const answered =
      result.ok || result.status === 405 || result.status === 400 || result.status === 401
    const status = statusFor(answered, result.ms)
    let detail = answered ? 'Member mail API up · sends through Resend' : 'Member mail API error'
    if (localAdmin && answered) {
      detail = 'Live mail is up (Resend). On this computer, run the member site on port 3002 for local test sends.'
    } else if (localAdmin && !answered) {
      detail = 'Could not reach live mail API on onestepfitness.sg'
    }
    return { ...base, status, ms: answered ? result.ms : null, detail }
  } catch {
    return {
      ...base,
      status: 'down',
      ms: null,
      detail: localAdmin
        ? 'Could not reach live mail API (Resend lives on the member site)'
        : 'Mail API did not answer',
    }
  }
}

async function checkPayments(): Promise<ServiceHealth> {
  const key = process.env.HITPAY_API_KEY
  const live = process.env.HITPAY_ENV === 'production' || process.env.HITPAY_ENV === 'live'
  const base = { id: 'payments', label: live ? 'HitPay' : 'HitPay (test)', address: live ? 'api.hit-pay.com' : 'api.sandbox.hit-pay.com' }
  if (!key) return { ...base, status: 'off', ms: null, detail: 'Not connected' }
  try {
    const result = await timed(`https://${base.address}/v1/payment-requests?per_page=1`, { headers: { 'X-BUSINESS-API-KEY': key } })
    return { ...base, status: statusFor(result.ok, result.ms), ms: result.ok ? result.ms : null, detail: result.ok ? 'Taking payments' : 'Payments error' }
  } catch {
    return { ...base, status: 'down', ms: null, detail: 'Did not answer' }
  }
}

async function checkWhatsApp(): Promise<ServiceHealth | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) return null
  const base = { id: 'whatsapp', label: 'WhatsApp', address: 'graph.facebook.com' }
  try {
    const result = await timed(`https://graph.facebook.com/v21.0/${phoneNumberId}`, { headers: { Authorization: `Bearer ${token}` } })
    return { ...base, status: statusFor(result.ok, result.ms), ms: result.ok ? result.ms : null, detail: result.ok ? 'Ready to send' : 'WhatsApp error' }
  } catch {
    return { ...base, status: 'down', ms: null, detail: 'Did not answer' }
  }
}

async function getDatabaseMetrics(): Promise<DatabaseMetrics | null> {
  const { data, error } = await getSupabaseAdminClient().rpc('admin_system_metrics')
  if (error || !data) return null
  const raw = data as Record<string, unknown>
  return {
    databaseBytes: Number(raw.database_bytes) || 0,
    connections: Number(raw.connections) || 0,
    activeConnections: Number(raw.active_connections) || 0,
    maxConnections: Number(raw.max_connections) || 0,
    cacheHitRatio: raw.cache_hit_ratio == null ? null : Number(raw.cache_hit_ratio),
    startedAt: String(raw.started_at || ''),
    tables: ((raw.tables as { name: string; rows: number; bytes: number }[]) || []).map((t) => ({
      name: t.name,
      rows: Number(t.rows) || 0,
      bytes: Number(t.bytes) || 0,
    })),
    storage: ((raw.storage as { bucket: string; files: number; bytes: number }[]) || []).map((b) => ({
      bucket: b.bucket,
      files: Number(b.files) || 0,
      bytes: Number(b.bytes) || 0,
    })),
  }
}

function sgtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
}

async function getActivityMetrics(): Promise<ActivityMetrics> {
  const admin = getSupabaseAdminClient()
  const now = new Date()
  const today = startOfSgtDay(now).toISOString()
  const weekStart = new Date(startOfSgtDay(now).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()

  const count = async (table: string, apply: (q: any) => any) => {
    const { count: total } = await apply(admin.from(table).select('id', { count: 'exact', head: true }))
    return total ?? 0
  }

  const [members, newMembersToday, bookingsToday, paidToday, pendingToday, failedToday, emailsSent, emailsFailed, paidRows, weekBookings, weekPaid] =
    await Promise.all([
      count('user_profiles', (q) => q),
      count('user_profiles', (q) => q.gte('created_at', today)),
      count('bookings', (q) => q.gte('booked_at', today)),
      count('payments', (q) => q.eq('status', 'succeeded').gte('created_at', today)),
      count('payments', (q) => q.eq('status', 'pending').gte('created_at', today)),
      count('payments', (q) => q.eq('status', 'failed').gte('created_at', today)),
      count('notifications', (q) => q.eq('channel', 'email').in('status', ['sent', 'delivered', 'read']).gte('created_at', today)),
      count('notifications', (q) => q.eq('channel', 'email').eq('status', 'failed').gte('created_at', today)),
      admin.from('payments').select('amount_cents').eq('status', 'succeeded').gte('created_at', today),
      admin.from('bookings').select('booked_at').gte('booked_at', weekStart),
      admin.from('payments').select('created_at').eq('status', 'succeeded').gte('created_at', weekStart),
    ])

  const days: { date: string; bookings: number; paid: number }[] = []
  for (let i = 6; i >= 0; i--) {
    days.push({ date: sgtDate(new Date(startOfSgtDay(now).getTime() - i * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString()), bookings: 0, paid: 0 })
  }
  const byDate = new Map(days.map((d) => [d.date, d]))
  for (const row of weekBookings.data || []) {
    const day = byDate.get(sgtDate(row.booked_at))
    if (day) day.bookings++
  }
  for (const row of weekPaid.data || []) {
    const day = byDate.get(sgtDate(row.created_at))
    if (day) day.paid++
  }

  return {
    members,
    newMembersToday,
    bookingsToday,
    paymentsToday: {
      paid: paidToday,
      pending: pendingToday,
      failed: failedToday,
      amount: (paidRows.data || []).reduce((sum, row) => sum + Number(row.amount_cents || 0), 0) / 100,
    },
    emailsToday: { sent: emailsSent, failed: emailsFailed },
    week: days,
  }
}

async function getJobMetrics(): Promise<JobMetrics | null> {
  const admin = getSupabaseAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [all, failed, last] = await Promise.all([
    admin.from('cron_job_runs').select('id', { count: 'exact', head: true }).gte('ran_at', since),
    admin.from('cron_job_runs').select('id', { count: 'exact', head: true }).gte('ran_at', since).eq('needs_attention', true),
    admin.from('cron_job_runs').select('ran_at').order('ran_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (all.error) return null
  return { runs: all.count ?? 0, failed: failed.count ?? 0, lastRunAt: last.data?.ran_at ?? null }
}

export async function getSystemHealth() {
  const [services, database, activity, jobs] = await Promise.all([
    Promise.all([checkRecords(), checkSite(), checkEmail(), checkPayments(), checkWhatsApp()]).then((list) =>
      list.filter((s): s is ServiceHealth => s !== null),
    ),
    getDatabaseMetrics().catch(() => null),
    getActivityMetrics().catch(() => null),
    getJobMetrics().catch(() => null),
  ])
  return { checkedAt: new Date().toISOString(), services, database, activity, jobs }
}
