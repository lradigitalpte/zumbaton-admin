/**
 * POST /api/users/[userId]/referral-voucher/generate
 * Create an admin-issued referral voucher for the user (discount %). Saves to DB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { z } from 'zod'

const BodySchema = z.object({
  discountPercent: z.number().int().min(1).max(100),
})

async function handleGenerate(
  request: NextRequest,
  context: { params: Promise<{ userId: string }>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params
    const body = await request.json().catch(() => ({}))
    const parseResult = BodySchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid discount (1–100%)' } },
        { status: 400 }
      )
    }
    const { discountPercent } = parseResult.data

    const admin = getSupabaseAdminClient()

    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('id, email, name')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    const voucherCode = `ZUMB-V-${Date.now().toString(36).toUpperCase().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const { data: voucher, error: insertError } = await admin
      .from('referral_vouchers')
      .insert({
        user_id: userId,
        discount_percent: discountPercent,
        voucher_code: voucherCode,
        created_by: context.user.id,
      })
      .select('id, voucher_code, discount_percent, created_at')
      .single()

    if (insertError) {
      console.error('[Referral Voucher] Generate error:', insertError)
      return NextResponse.json(
        { success: false, error: { message: insertError.message || 'Failed to create voucher' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: voucher.id,
        voucherCode: voucher.voucher_code,
        discountPercent: voucher.discount_percent,
        createdAt: voucher.created_at,
      },
    })
  } catch (error) {
    console.error('[Referral Voucher] Generate:', error)
    return NextResponse.json(
      { success: false, error: { message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleGenerate, { requiredRole: 'admin' })
