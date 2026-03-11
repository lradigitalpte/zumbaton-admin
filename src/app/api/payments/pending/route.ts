/**
 * Admin Pending Payments API
 * GET /api/payments/pending
 *
 * Returns all payments with status 'pending' or 'in_progress', enriched
 * with the user's name/email. Used by the Token Transactions page so admins
 * can see stuck payments and manually sync them.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'

export async function GET(_request: NextRequest) {
  try {
    const adminClient = getSupabaseAdminClient()

    // Fetch all pending/in_progress package payments (exclude trial bookings to keep it focused)
    const { data: payments, error } = await adminClient
      .from(TABLES.PAYMENTS)
      .select('id, user_id, package_id, amount_cents, currency, status, provider, hitpay_payment_request_id, hitpay_payment_id, created_at, updated_at, metadata, promo_type, discount_percent, discount_amount_cents, original_amount_cents')
      .in('status', ['pending', 'in_progress'])
      .eq('is_trial_booking', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[API /payments/pending] DB error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch pending payments' }, { status: 500 })
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Fetch user profiles for these payments
    const userIds = [...new Set(payments.map((p: { user_id: string }) => p.user_id).filter(Boolean))]

    let userMap: Record<string, { name: string | null; email: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from(TABLES.USER_PROFILES)
        .select('id, name, email')
        .in('id', userIds)

      if (profiles) {
        userMap = profiles.reduce(
          (acc: Record<string, { name: string | null; email: string | null }>, p: { id: string; name: string | null; email: string | null }) => {
            acc[p.id] = { name: p.name, email: p.email }
            return acc
          },
          {}
        )
      }
    }

    // Fetch package names
    const packageIds = [...new Set(payments.map((p: { package_id: string | null }) => p.package_id).filter(Boolean))]
    let packageMap: Record<string, { name: string; token_count: number }> = {}
    if (packageIds.length > 0) {
      const { data: packages } = await adminClient
        .from('packages')
        .select('id, name, token_count')
        .in('id', packageIds)

      if (packages) {
        packageMap = packages.reduce(
          (acc: Record<string, { name: string; token_count: number }>, pkg: { id: string; name: string; token_count: number }) => {
            acc[pkg.id] = { name: pkg.name, token_count: pkg.token_count }
            return acc
          },
          {}
        )
      }
    }

    const enriched = payments.map((p: {
      id: string
      user_id: string
      package_id: string | null
      amount_cents: number
      currency: string
      status: string
      provider: string | null
      hitpay_payment_request_id: string | null
      hitpay_payment_id: string | null
      created_at: string
      updated_at: string
      metadata: unknown
      promo_type: string | null
      discount_percent: number | null
      discount_amount_cents: number | null
      original_amount_cents: number | null
    }) => {
      const user = userMap[p.user_id] || { name: 'Unknown', email: '' }
      const pkg = p.package_id ? (packageMap[p.package_id] || null) : null
      const meta = (p.metadata as { package_name?: string; token_count?: number } | null) || {}

      return {
        id: p.id,
        userId: p.user_id,
        userName: user.name || 'Unknown',
        userEmail: user.email || '',
        packageName: pkg?.name || meta.package_name || 'Unknown package',
        tokenCount: pkg?.token_count || meta.token_count || 0,
        amountCents: p.amount_cents,
        originalAmountCents: p.original_amount_cents ?? p.amount_cents,
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        hitpayPaymentRequestId: p.hitpay_payment_request_id,
        hitpayPaymentId: p.hitpay_payment_id,
        promoType: p.promo_type,
        discountPercent: p.discount_percent ?? 0,
        discountAmountCents: p.discount_amount_cents ?? 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }
    })

    return NextResponse.json({ success: true, data: enriched })
  } catch (err) {
    console.error('[API /payments/pending] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
