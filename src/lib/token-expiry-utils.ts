import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { startOfSgtDay } from '@/lib/reports-utils'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface PackageExpiryCounts {
  expiringSoon: number
  expired: number
}

export function getPackageExpiryBounds(now = new Date()) {
  const startOfTodaySgt = startOfSgtDay(now).toISOString()
  const startOfWindowEndSgt = new Date(startOfSgtDay(now).getTime() + 8 * MS_PER_DAY).toISOString()
  return { startOfTodaySgt, startOfWindowEndSgt }
}

/** Packages with expires_at >= this cutoff are still usable today (SGT calendar day). */
export function getUsablePackageExpiryCutoff(now = new Date()): string {
  return startOfSgtDay(now).toISOString()
}

/** Active packages with expires_at < this cutoff should be marked expired. */
export function getExpiredPackageCutoff(now = new Date()): string {
  return startOfSgtDay(now).toISOString()
}

export async function getPackageExpiryCounts(now = new Date()): Promise<PackageExpiryCounts> {
  const adminClient = getSupabaseAdminClient()
  const { startOfTodaySgt, startOfWindowEndSgt } = getPackageExpiryBounds(now)

  const [expiringCountRes, expiredCountRes] = await Promise.all([
    adminClient
      .from(TABLES.USER_PACKAGES)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('expires_at', startOfTodaySgt)
      .lt('expires_at', startOfWindowEndSgt)
      .gt('tokens_remaining', 0),
    adminClient
      .from(TABLES.USER_PACKAGES)
      .select('id', { count: 'exact', head: true })
      .or(`status.eq.expired,and(status.eq.active,expires_at.lt.${startOfTodaySgt})`),
  ])

  return {
    expiringSoon: expiringCountRes.count ?? 0,
    expired: expiredCountRes.count ?? 0,
  }
}
