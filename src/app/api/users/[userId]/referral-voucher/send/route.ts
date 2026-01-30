/**
 * POST /api/users/[userId]/referral-voucher/send
 * Send the referral voucher email to the user (via web app email API).
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { z } from 'zod'

const BodySchema = z.object({
  voucherId: z.string().uuid(),
})

async function handleSend(
  request: NextRequest,
  context: { params: Promise<{ userId: string }>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params
    const body = await request.json().catch(() => ({}))
    const parseResult = BodySchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Voucher ID is required' } },
        { status: 400 }
      )
    }
    const { voucherId } = parseResult.data

    const admin = getSupabaseAdminClient()

    const { data: voucher, error: voucherError } = await admin
      .from('referral_vouchers')
      .select('id, user_id, voucher_code, discount_percent, sent_at')
      .eq('id', voucherId)
      .eq('user_id', userId)
      .single()

    if (voucherError || !voucher) {
      return NextResponse.json(
        { success: false, error: { message: 'Voucher not found' } },
        { status: 404 }
      )
    }

    if (voucher.sent_at) {
      return NextResponse.json(
        { success: false, error: { message: 'Voucher email was already sent' } },
        { status: 400 }
      )
    }

    const { data: profile } = await admin
      .from('user_profiles')
      .select('email, name')
      .eq('id', userId)
      .single()

    if (!profile?.email) {
      return NextResponse.json(
        { success: false, error: { message: 'User has no email address' } },
        { status: 400 }
      )
    }

    const { getWebAppUrl } = await import('@/lib/email-url')
    const webAppUrl = getWebAppUrl()
    const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'

    const response = await fetch(`${webAppUrl}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'referral-voucher',
        secret: emailApiSecret,
        data: {
          userEmail: profile.email,
          userName: profile.name || 'Customer',
          voucherCode: voucher.voucher_code,
          discountPercent: voucher.discount_percent,
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[Referral Voucher] Email API error:', errorBody)
      return NextResponse.json(
        { success: false, error: { message: 'Failed to send email' } },
        { status: 500 }
      )
    }

    const result = await response.json()
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error || 'Failed to send email' } },
        { status: 500 }
      )
    }

    await admin
      .from('referral_vouchers')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', voucherId)

    return NextResponse.json({
      success: true,
      message: 'Voucher email sent successfully',
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('[Referral Voucher] Send:', error)
    return NextResponse.json(
      { success: false, error: { message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleSend, { requiredRole: 'admin' })
