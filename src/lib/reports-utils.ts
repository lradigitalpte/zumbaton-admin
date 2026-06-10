/**
 * Shared helpers for reports APIs — SGT date bounds and bulk fetch utilities.
 */

import type { getSupabaseAdminClient } from '@/lib/supabase'

export const SGT_TIMEZONE = 'Asia/Singapore'
export const SGT_OFFSET_MS = 8 * 60 * 60 * 1000
export const BOOKING_COUNT_STATUSES = ['confirmed', 'attended', 'no-show'] as const

type SupabaseAdmin = ReturnType<typeof getSupabaseAdminClient>

export function getSgtYmd(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SGT_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  return {
    year: parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10),
    month: parseInt(parts.find(p => p.type === 'month')?.value || '1', 10),
    day: parseInt(parts.find(p => p.type === 'day')?.value || '1', 10),
  }
}

/** Midnight at the start of the given SGT calendar day, as UTC instant. */
export function startOfSgtDay(date: Date): Date {
  const { year, month, day } = getSgtYmd(date)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - SGT_OFFSET_MS)
}

/** Whole calendar days from SGT today until the package expiry date (0 = expires today). */
export function sgtDaysUntilExpiry(expiresAtIso: string, now = new Date()): number {
  const expiryStart = startOfSgtDay(new Date(expiresAtIso)).getTime()
  const todayStart = startOfSgtDay(now).getTime()
  return Math.round((expiryStart - todayStart) / (24 * 60 * 60 * 1000))
}

/** True when the package expiry calendar date in SGT is before today in SGT. */
export function isExpiredBySgtCalendar(expiresAtIso: string, now = new Date()): boolean {
  return sgtDaysUntilExpiry(expiresAtIso, now) < 0
}

export function getMonthBoundsSgt(year: number, month: number) {
  const rangeStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - SGT_OFFSET_MS)
  const rangeEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - SGT_OFFSET_MS)
  const monthName = new Intl.DateTimeFormat('en-US', { timeZone: SGT_TIMEZONE, month: 'long' }).format(rangeStart)
  return { rangeStart, rangeEnd, monthName }
}

export function getYearBoundsSgt(year: number) {
  return {
    rangeStart: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0) - SGT_OFFSET_MS),
    rangeEnd: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0) - SGT_OFFSET_MS),
  }
}

/** SGT calendar month (1–12) for an ISO timestamp. */
export function getSgtMonthNumber(iso: string): number {
  return getSgtYmd(new Date(iso)).month
}

/** Assign ISO timestamps into 12 month buckets (index 0 = Jan). */
export function initMonthBuckets<T>(factory: () => T): T[] {
  return Array.from({ length: 12 }, factory)
}

export async function fetchInBatches<T>(
  ids: string[],
  fetchBatch: (batch: string[]) => Promise<T[]>,
  batchSize = 80
): Promise<T[]> {
  if (ids.length === 0) return []
  const unique = [...new Set(ids)]
  const results: T[] = []
  const batches = Array.from({ length: Math.ceil(unique.length / batchSize) }, (_, i) =>
    unique.slice(i * batchSize, (i + 1) * batchSize)
  )
  const batchResults = await Promise.all(batches.map(fetchBatch))
  for (const rows of batchResults) results.push(...rows)
  return results
}

export const PLACEHOLDER_CLASS_PATTERNS = [
  'zumfamilia custom schedule',
  'zumfiesta guest booking',
]

export function isPlaceholderClassTitle(title: string): boolean {
  const t = title.toLowerCase()
  return PLACEHOLDER_CLASS_PATTERNS.some(pattern => t.includes(pattern))
}
