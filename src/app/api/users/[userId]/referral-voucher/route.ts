/**
 * GET /api/users/[userId]/referral-voucher
 * Get the latest referral voucher for this user (for UI: show code and sent status).
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

async function handleGet(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params
    const admin = getSupabaseAdminClient()

    const { data: voucher, error } = await admin
      .from('referral_vouchers')
      .select('id, voucher_code, discount_percent, created_at, sent_at, used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[Referral Voucher] Get error:', error)
      return NextResponse.json(
        { success: false, error: { message: 'Failed to load voucher' } },
        { status: 500 }
      )
    }

    if (!voucher) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: voucher.id,
        voucherCode: voucher.voucher_code,
        discountPercent: voucher.discount_percent,
        createdAt: voucher.created_at,
        sentAt: voucher.sent_at,
        usedAt: voucher.used_at,
      },
    })
  } catch (error) {
    console.error('[Referral Voucher] Get:', error)
    return NextResponse.json(
      { success: false, error: { message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGet, { requiredRole: 'admin' })
