/**
 * Admin Payment Sync API
 * POST /api/payments/[paymentId]/sync
 *
 * Manually syncs a pending payment with HitPay and, if paid, issues the
 * tokens to the user. Useful when the webhook was missed or delayed.
 * Requires admin or super_admin role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdmin, AuthenticatedUser } from '@/middleware/rbac'
import { getPaymentRequestStatus } from '@/services/hitpay.service'
import { createClient } from '@supabase/supabase-js'
import { createAuditLog } from '@/services/rbac.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteParams = { paymentId: string }

async function handleSyncPayment(
  _request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { paymentId } = await context.params

    // 1. Load payment from DB
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*, packages(*)')
      .eq('id', paymentId)
      .single()

    if (fetchError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (!payment.hitpay_payment_request_id) {
      return NextResponse.json({ error: 'Payment has no HitPay request ID' }, { status: 400 })
    }

    // 2. Already processed – nothing to do
    if (payment.status === 'succeeded' || payment.status === 'completed') {
      return NextResponse.json({ message: 'Payment already processed', status: payment.status })
    }

    // 3. Check HitPay
    if (!process.env.HITPAY_API_KEY) {
      console.error('[AdminSync] HITPAY_API_KEY is not set in environment variables')
      return NextResponse.json(
        { error: 'HitPay API key not configured on this server. Add HITPAY_API_KEY to environment variables.' },
        { status: 503 }
      )
    }

    let hitpayData
    try {
      hitpayData = await getPaymentRequestStatus(payment.hitpay_payment_request_id)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[AdminSync] HitPay API error:', errMsg)

      // HitPay returned 404 — payment request doesn't exist in HitPay at all
      // (likely a sandbox/test payment or an abandoned checkout). Mark as failed.
      if (errMsg.toLowerCase().includes('no query results')) {
        await supabaseAdmin
          .from('payments')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', paymentId)
        return NextResponse.json(
          {
            error: 'not_found_on_hitpay',
            message: 'This payment request was not found on HitPay (possibly a test/abandoned payment). It has been marked as failed.',
            markedFailed: true,
          },
          { status: 404 }
        )
      }

      return NextResponse.json({ error: `Failed to reach HitPay API: ${errMsg}` }, { status: 502 })
    }

    const hitpayStatus = hitpayData.status?.toLowerCase()
    const hitpayPaymentId = hitpayData.payments?.[0]?.id ?? null

    if (hitpayStatus !== 'completed' && hitpayStatus !== 'succeeded') {
      return NextResponse.json({
        message: 'Payment not yet completed on HitPay',
        hitpayStatus,
        ourStatus: payment.status,
      })
    }

    // 4. Idempotency — check if user_package already exists
    const { data: existingPackage } = await supabaseAdmin
      .from('user_packages')
      .select('id')
      .eq('payment_id', payment.id)
      .maybeSingle()

    if (existingPackage) {
      // Tokens already issued — just update payment status
      await supabaseAdmin
        .from('payments')
        .update({ status: 'succeeded', hitpay_payment_id: hitpayPaymentId, updated_at: new Date().toISOString() })
        .eq('id', payment.id)

      await createAuditLog({
        userId: context.user.id,
        action: 'payment_sync',
        resourceType: 'payment',
        resourceId: payment.id,
        newValues: { note: 'Status corrected; tokens were already issued', hitpayStatus },
      })

      return NextResponse.json({ message: 'Payment status corrected (tokens already issued)', status: 'succeeded' })
    }

    // 5. Get package details
    let pkg = payment.packages
    if (!pkg && payment.package_id) {
      const { data: packageData } = await supabaseAdmin
        .from('packages')
        .select('*')
        .eq('id', payment.package_id)
        .single()
      pkg = packageData
    }

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found for this payment' }, { status: 500 })
    }

    // 6. Update payment status
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({ status: 'succeeded', hitpay_payment_id: hitpayPaymentId, updated_at: new Date().toISOString() })
      .eq('id', payment.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 })
    }

    // 7. Create user_package with tokens
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + pkg.validity_days)

    const { data: userPackage, error: upError } = await supabaseAdmin
      .from('user_packages')
      .insert({
        user_id: payment.user_id,
        package_id: payment.package_id,
        payment_id: payment.id.toString(),
        tokens_remaining: pkg.token_count,
        tokens_held: 0,
        expires_at: expiresAt.toISOString(),
        status: 'active',
      })
      .select()
      .single()

    if (upError) {
      console.error('[AdminSync] Failed to create user_package:', upError)
      return NextResponse.json({ error: 'Failed to issue tokens', details: upError.message }, { status: 500 })
    }

    // 8. Record promo usage if applicable
    if (payment.promo_type && payment.discount_percent && payment.discount_percent > 0) {
      await supabaseAdmin.from('promo_usage').insert({
        user_id: payment.user_id,
        promo_type: payment.promo_type,
        discount_percent: payment.discount_percent,
        discount_amount_cents: payment.discount_amount_cents || 0,
        package_id: payment.package_id,
        payment_id: payment.id,
      }).then(({ error }) => {
        if (error) console.error('[AdminSync] Failed to record promo usage:', error)
      })
    }

    // 9. Mark voucher as used if applicable
    const voucherId = (payment as { referral_voucher_id?: string | null }).referral_voucher_id
    if (voucherId) {
      await supabaseAdmin
        .from('referral_vouchers')
        .update({ used_at: new Date().toISOString(), payment_id: payment.id })
        .eq('id', voucherId)
    }

    // 10. Token transaction log
    await supabaseAdmin.from('token_transactions').insert({
      user_id: payment.user_id,
      user_package_id: userPackage.id,
      transaction_type: 'purchase',
      tokens_change: pkg.token_count,
      tokens_before: 0,
      tokens_after: pkg.token_count,
      description: `Purchased ${pkg.name} (admin sync)`,
    })

    // 11. Update user stats (non-blocking)
    try {
      await supabaseAdmin.rpc('increment_user_stat', { p_user_id: payment.user_id, p_field: 'total_tokens_purchased', p_amount: pkg.token_count })
      await supabaseAdmin.rpc('increment_user_stat', { p_user_id: payment.user_id, p_field: 'total_spent_cents', p_amount: payment.amount_cents })
    } catch (_) { /* non-critical */ }

    // 12. Create invoice
    await supabaseAdmin.from('invoices').insert({
      user_id: payment.user_id,
      payment_id: payment.id,
      invoice_number: `INV-${Date.now()}`,
      amount_cents: payment.amount_cents,
      tax_cents: 0,
      total_cents: payment.amount_cents,
      currency: payment.currency,
      status: 'paid',
      issued_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
    })

    // 13. In-app notification for the user
    await supabaseAdmin.from('notifications').insert({
      user_id: payment.user_id,
      type: 'payment_successful',
      channel: 'in_app',
      subject: 'Payment Confirmed!',
      body: `Your purchase of ${pkg.name} has been confirmed. ${pkg.token_count} tokens have been added to your account.`,
      status: 'sent',
      sent_at: new Date().toISOString(),
      data: { payment_id: payment.id, package_name: pkg.name, token_count: pkg.token_count, amount: payment.amount_cents / 100 },
    })

    // 14. Audit log
    await createAuditLog({
      userId: context.user.id,
      action: 'payment_sync',
      resourceType: 'payment',
      resourceId: payment.id,
      newValues: {
        note: 'Manually synced from HitPay by admin',
        hitpayStatus,
        tokensIssued: pkg.token_count,
        userPackageId: userPackage.id,
      },
    })

    console.log('[AdminSync] Payment synced successfully:', payment.id, '— tokens issued:', pkg.token_count)

    return NextResponse.json({
      message: 'Payment confirmed and tokens issued successfully',
      status: 'succeeded',
      tokensIssued: pkg.token_count,
      packageName: pkg.name,
      userPackageId: userPackage.id,
    })
  } catch (error) {
    console.error('[AdminSync] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const POST = withAdmin(handleSyncPayment)
