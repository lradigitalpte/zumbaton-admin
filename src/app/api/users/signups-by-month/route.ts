/**
 * GET /api/users/signups-by-month?months=12
 * New member sign-ups per month (Singapore time), split by how the account was created:
 *   selfSignup = signup_source 'public' (or NULL: Google signup that hasn't finished onboarding)
 *   staffAdded = signup_source 'admin'
 * Counts members (role 'user') only. Counts across ALL members — not limited by the list page size.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

function sgtMonthKey(iso: string): string {
  // en-CA gives "YYYY-MM"
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit' })
}

function lastMonthKeys(count: number): string[] {
  const now = new Date(sgtMonthKey(new Date().toISOString()) + '-15T00:00:00Z')
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

async function handleGet(
  request: NextRequest,
  _context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const monthsParam = Number(new URL(request.url).searchParams.get('months') || 12)
    const months = Number.isFinite(monthsParam) ? Math.min(36, Math.max(1, Math.round(monthsParam))) : 12

    const db = getSupabaseAdminClient()
    const rows: { created_at: string; signup_source: string | null }[] = []
    // Page through in chunks of 1000 (PostgREST default max).
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('user_profiles')
        .select('created_at, signup_source')
        .eq('role', 'user')
        .order('created_at', { ascending: true })
        .range(from, from + 999)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < 1000) break
    }

    const keys = lastMonthKeys(months)
    const buckets = new Map(keys.map((k) => [k, { month: k, selfSignup: 0, staffAdded: 0, total: 0 }]))
    for (const r of rows) {
      const b = buckets.get(sgtMonthKey(r.created_at))
      if (!b) continue
      if (r.signup_source === 'admin') b.staffAdded += 1
      else b.selfSignup += 1
      b.total += 1
    }

    return NextResponse.json({ success: true, data: { months: [...buckets.values()], totalMembers: rows.length } })
  } catch (error) {
    console.error('[signups-by-month] error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load sign-ups by month' } },
      { status: 500 }
    )
  }
}

export const GET = withAuthentication(handleGet)
