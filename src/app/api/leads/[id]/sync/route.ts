/**
 * Sync a quick-join / fast-trial lead's payment status with HitPay.
 * POST /api/leads/[id]/sync
 *
 * The /start flow marks a lead "paid" locally only after HitPay's webhook
 * fires or the guest returns to the pick-class page. If either is missed,
 * the payment stays "pending" forever even though the guest may have paid.
 * This lets staff manually re-check HitPay and correct the status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getPaymentRequestStatus } from '@/services/hitpay.service'
import { sendAdminEmail } from '@/lib/admin-email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    if (!['super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
    }

    const { id } = await context.params
    const supabase = getSupabaseAdminClient()
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('id, status, amount_cents, currency, hitpay_payment_request_id, metadata')
      .eq('id', id)
      .single()
    if (fetchError || !payment) {
      return NextResponse.json({ success: false, error: { message: 'Lead not found' } }, { status: 404 })
    }

    if (payment.status === 'succeeded' || payment.status === 'completed') {
      return NextResponse.json({ success: true, data: { status: payment.status, changed: false } })
    }

    if (!payment.hitpay_payment_request_id) {
      return NextResponse.json({ success: false, error: { message: 'This lead has no linked HitPay payment request' } }, { status: 400 })
    }

    let hitpayData
    try {
      hitpayData = await getPaymentRequestStatus(payment.hitpay_payment_request_id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.toLowerCase().includes('no query results')) {
        await supabase.from('payments').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', id)
        return NextResponse.json({
          success: true,
          data: { status: 'failed', changed: true, note: 'Not found on HitPay — marked as failed (likely an abandoned checkout).' },
        })
      }
      return NextResponse.json({ success: false, error: { message: `Failed to reach HitPay: ${message}` } }, { status: 502 })
    }

    const hitpayStatus = hitpayData.status?.toLowerCase()
    if (hitpayStatus !== 'completed' && hitpayStatus !== 'succeeded') {
      return NextResponse.json({ success: true, data: { status: payment.status, changed: false, hitpayStatus } })
    }

    const hitpayPaymentId = hitpayData.payments?.[0]?.id ?? null
    await supabase
      .from('payments')
      .update({ status: 'succeeded', hitpay_payment_id: hitpayPaymentId, updated_at: new Date().toISOString() })
      .eq('id', id)

    const metadata = (payment.metadata as Record<string, unknown>) || {}
    const guestName = (metadata.guest_name as string) || 'Guest'
    const guestEmail = (metadata.guest_email as string) || ''
    const guestPhone = (metadata.guest_phone as string) || ''
    const venueLabel = (metadata.promo_label as string) || 'Fast trial'

    // Same staff alert the webhook sends on success, in case scheduling was missed.
    try {
      const { data: adminUsers } = await supabase
        .from('user_profiles')
        .select('id')
        .in('role', ['admin', 'super_admin'])
        .eq('is_active', true)
      if (adminUsers?.length) {
        await supabase.from('notifications').insert(
          adminUsers.map((admin) => ({
            user_id: admin.id,
            type: 'trial_booking',
            channel: 'in_app',
            status: 'sent',
            sent_at: new Date().toISOString(),
            subject: 'PAID — schedule this guest',
            body: `${guestName} paid $${(payment.amount_cents / 100).toFixed(2)} for ${venueLabel}. Contact ${guestPhone || guestEmail} to arrange their class. (Confirmed via manual sync — webhook may have been missed.)`,
            data: {
              payment_id: id,
              flow_type: metadata.flow_type,
              needs_scheduling: true,
              guest_name: guestName,
              guest_email: guestEmail,
              guest_phone: guestPhone,
            },
          }))
        )
      }
      await sendAdminEmail('payment-alert', {
        paymentId: id,
        paymentType: 'trial-booking',
        source: 'admin-sync',
        amount: payment.amount_cents / 100,
        currency: payment.currency,
        guestName,
        guestEmail,
        className: `${venueLabel} — NEEDS SCHEDULING (confirmed via manual sync)`,
      })
    } catch (notifyErr) {
      console.error('[LeadSync] Non-critical: staff notification failed:', notifyErr)
    }

    return NextResponse.json({ success: true, data: { status: 'succeeded', changed: true, hitpayStatus } })
  } catch (error) {
    console.error('[API /leads/[id]/sync]', error)
    return NextResponse.json({ success: false, error: { message: 'Server error' } }, { status: 500 })
  }
}
