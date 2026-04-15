import { NextRequest, NextResponse } from 'next/server'
import { withAdmin, AuthenticatedUser } from '@/middleware/rbac'
import { createClient } from '@supabase/supabase-js'
import { createAuditLog } from '@/services/rbac.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteParams = { paymentId: string }

async function handleDeletePayment(
  _request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { paymentId } = await context.params

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, status, is_trial_booking, hitpay_payment_request_id, amount_cents, currency')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (!['pending', 'in_progress', 'failed'].includes(payment.status)) {
      return NextResponse.json(
        { error: 'Only pending/in-progress/failed payments can be deleted' },
        { status: 400 }
      )
    }

    // Prevent deleting already-processed payments that issued tokens.
    const { data: existingUserPackage } = await supabaseAdmin
      .from('user_packages')
      .select('id')
      .eq('payment_id', payment.id)
      .maybeSingle()

    if (existingUserPackage) {
      return NextResponse.json(
        { error: 'Cannot delete payment because tokens were already issued' },
        { status: 400 }
      )
    }

    // For trial flows, avoid deleting if there is a non-draft booking attached.
    const { data: linkedBooking } = await supabaseAdmin
      .from('bookings')
      .select('id, status')
      .eq('payment_id', payment.id)
      .maybeSingle()

    if (linkedBooking && linkedBooking.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot delete payment because booking is already confirmed/processed' },
        { status: 400 }
      )
    }

    if (linkedBooking && linkedBooking.status === 'draft') {
      await supabaseAdmin
        .from('bookings')
        .delete()
        .eq('id', linkedBooking.id)
    }

    const { error: deleteError } = await supabaseAdmin
      .from('payments')
      .delete()
      .eq('id', payment.id)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
    }

    await createAuditLog({
      userId: context.user.id,
      action: 'delete_payment',
      resourceType: 'payment',
      resourceId: payment.id,
      newValues: {
        note: 'Deleted pending payment from Token Transactions pending list',
        hitpayPaymentRequestId: payment.hitpay_payment_request_id,
        amountCents: payment.amount_cents,
        currency: payment.currency,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Pending payment deleted successfully',
    })
  } catch (error) {
    console.error('[Delete Payment] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const DELETE = withAdmin(handleDeletePayment)
