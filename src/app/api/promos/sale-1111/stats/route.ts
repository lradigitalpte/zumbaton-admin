/**
 * GET /api/promos/sale-1111/stats — 11:11 Sale funnel for the admin settings page.
 *
 * - counts:  raw event totals (promo_events, written by the public site)
 * - funnel:  unique people at each step
 * - people:  one row per person (signed-in member, or anonymous browser) with what
 *            they did, joined with paid purchases from `payments`
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

const SALE_1111_PACKAGE_NAME = '11:11 Sale - 6 Sessions'
const MAX_EVENTS = 20000
const MAX_PEOPLE = 1000

const EVENTS = [
  'popup_view',
  'popup_dismiss',
  'popup_signup_click',
  'popup_signin_click',
  'popup_buy_click',
  'strip_click',
  'page_view',
  'page_cta_click',
  'packages_card_click',
  'packages_view',
] as const

const CLICK_EVENTS = new Set([
  'popup_signup_click',
  'popup_signin_click',
  'popup_buy_click',
  'strip_click',
  'page_cta_click',
  'packages_card_click',
])

const CLICK_LABELS: Record<string, string> = {
  popup_signup_click: 'Popup: Sign up',
  popup_signin_click: 'Popup: Sign in',
  popup_buy_click: 'Popup: Buy now',
  strip_click: 'Header strip',
  page_cta_click: '/1111 button',
  packages_card_click: 'Buy tokens card',
}

export interface Sale1111Person {
  key: string
  userId: string | null
  name: string | null
  email: string | null
  phone: string | null
  /** Account created after their first 11:11 interaction. */
  newMember: boolean
  firstSeen: string | null
  lastSeen: string | null
  sawPopup: boolean
  closedPopup: boolean
  visitedSalePage: boolean
  clicks: string[]
  reachedBuyTokens: boolean
  bought: boolean
  boughtAt: string | null
  paidCents: number
}

interface EventRow {
  event: string
  session_id: string | null
  user_id: string | null
  created_at: string
}

async function handleGetStats(
  _request: NextRequest,
  _context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const db = getSupabaseAdminClient()

    // ---- Events -------------------------------------------------------------
    let eventsAvailable = true
    const { data: eventRows, error: eventsError } = await db
      .from('promo_events')
      .select('event, session_id, user_id, created_at')
      .eq('promo', 'sale_1111')
      .order('created_at', { ascending: true })
      .limit(MAX_EVENTS)
    if (eventsError) eventsAvailable = false
    const events = (eventRows || []) as EventRow[]

    const counts: Record<string, number> = Object.fromEntries(EVENTS.map((e) => [e, 0]))
    for (const ev of events) counts[ev.event] = (counts[ev.event] ?? 0) + 1

    // ---- Purchases ----------------------------------------------------------
    let packageFound = false
    let purchases: { user_id: string | null; amount_cents: number | null; created_at: string }[] = []
    const { data: pkg } = await db
      .from('packages')
      .select('id')
      .eq('name', SALE_1111_PACKAGE_NAME)
      .maybeSingle()
    if (pkg?.id) {
      packageFound = true
      const { data: paid } = await db
        .from('payments')
        .select('user_id, amount_cents, created_at')
        .eq('package_id', pkg.id)
        .eq('status', 'succeeded')
      purchases = paid || []
    }
    const revenueCents = purchases.reduce((sum, p) => sum + (Number(p.amount_cents) || 0), 0)

    // ---- People: group events by member, else by anonymous browser id --------
    const people = new Map<string, Sale1111Person>()
    const blank = (key: string, userId: string | null): Sale1111Person => ({
      key,
      userId,
      name: null,
      email: null,
      phone: null,
      newMember: false,
      firstSeen: null,
      lastSeen: null,
      sawPopup: false,
      closedPopup: false,
      visitedSalePage: false,
      clicks: [],
      reachedBuyTokens: false,
      bought: false,
      boughtAt: null,
      paidCents: 0,
    })

    for (const ev of events) {
      const key = ev.user_id ? `u:${ev.user_id}` : ev.session_id ? `s:${ev.session_id}` : null
      if (!key) continue
      const p = people.get(key) ?? blank(key, ev.user_id)
      if (!p.firstSeen) p.firstSeen = ev.created_at
      p.lastSeen = ev.created_at
      if (ev.event === 'popup_view') p.sawPopup = true
      if (ev.event === 'popup_dismiss') p.closedPopup = true
      if (ev.event === 'page_view') p.visitedSalePage = true
      if (ev.event === 'packages_view' || ev.event === 'packages_card_click') p.reachedBuyTokens = true
      if (CLICK_EVENTS.has(ev.event)) {
        const label = CLICK_LABELS[ev.event] ?? ev.event
        if (!p.clicks.includes(label)) p.clicks.push(label)
      }
      people.set(key, p)
    }

    for (const purchase of purchases) {
      if (!purchase.user_id) continue
      const key = `u:${purchase.user_id}`
      const p = people.get(key) ?? blank(key, purchase.user_id)
      p.bought = true
      p.boughtAt = p.boughtAt && p.boughtAt < purchase.created_at ? p.boughtAt : purchase.created_at
      p.paidCents += Number(purchase.amount_cents) || 0
      p.reachedBuyTokens = true
      people.set(key, p)
    }

    // ---- Attach member details ----------------------------------------------
    const userIds = [...people.values()].map((p) => p.userId).filter((id): id is string => !!id)
    for (let i = 0; i < userIds.length; i += 200) {
      const { data: profiles } = await db
        .from('user_profiles')
        .select('id, name, email, phone, created_at')
        .in('id', userIds.slice(i, i + 200))
      for (const prof of profiles || []) {
        const p = people.get(`u:${prof.id}`)
        if (!p) continue
        p.name = prof.name ?? null
        p.email = prof.email ?? null
        p.phone = prof.phone ?? null
        p.newMember = !!(p.firstSeen && prof.created_at && prof.created_at > p.firstSeen)
      }
    }

    const all = [...people.values()]
    const funnel = {
      people: all.length,
      sawPopup: all.filter((p) => p.sawPopup).length,
      clicked: all.filter((p) => p.clicks.length > 0).length,
      identified: all.filter((p) => !!p.userId).length,
      newMembers: all.filter((p) => p.newMember).length,
      reachedBuyTokens: all.filter((p) => p.reachedBuyTokens).length,
      bought: all.filter((p) => p.bought).length,
    }

    // Buyers first, then members, then most recent activity.
    all.sort((a, b) => {
      if (a.bought !== b.bought) return a.bought ? -1 : 1
      if (!!a.userId !== !!b.userId) return a.userId ? -1 : 1
      return (b.lastSeen ?? b.boughtAt ?? '').localeCompare(a.lastSeen ?? a.boughtAt ?? '')
    })

    return NextResponse.json({
      success: true,
      data: {
        counts,
        funnel,
        people: all.slice(0, MAX_PEOPLE),
        peopleTruncated: all.length > MAX_PEOPLE,
        purchases: purchases.length,
        revenueCents,
        packageFound,
        eventsAvailable,
      },
    })
  } catch (error) {
    console.error('[sale-1111 stats] error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load 11:11 Sale stats' } },
      { status: 500 }
    )
  }
}

export const GET = withAuthentication(handleGetStats)
