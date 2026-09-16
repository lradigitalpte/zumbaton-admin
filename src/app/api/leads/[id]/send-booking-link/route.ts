/**
 * Send a paid pay-first lead a link to pick their own class.
 * POST /api/leads/[id]/send-booking-link
 *
 * For quick-join / fast-trial leads that paid but haven't been scheduled yet.
 * Emails the guest (and their +1, if any) a link to /start/pick-class so they
 * can self-serve instead of waiting on staff to call and book for them.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { sendAdminEmail } from '@/lib/admin-email'
import { getWebAppUrl } from '@/lib/email-url'

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
      .select('id, status, class_id, metadata')
      .eq('id', id)
      .eq('is_trial_booking', true)
      .single()
    if (fetchError || !payment) {
      return NextResponse.json({ success: false, error: { message: 'Lead not found' } }, { status: 404 })
    }

    const metadata = (payment.metadata as Record<string, any>) || {}
    const flowType = metadata.flow_type
    if (flowType !== 'quick_join' && flowType !== 'quick_trial') {
      return NextResponse.json(
        { success: false, error: { message: 'This lead is not eligible for self-booking' } },
        { status: 400 }
      )
    }
    if (payment.status !== 'succeeded' && payment.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: { message: 'This lead has not paid yet' } },
        { status: 400 }
      )
    }
    if (payment.class_id) {
      return NextResponse.json(
        { success: false, error: { message: 'This lead already has a class scheduled' } },
        { status: 400 }
      )
    }

    const guestName = (metadata.guest_name as string) || 'Guest'
    const guestEmail = (metadata.guest_email as string) || ''
    const venueLabel = (metadata.promo_label as string) || 'Trial class'
    const companionName = (metadata.companion_name as string) || ''
    const companionEmail = (metadata.companion_email as string) || ''

    if (!guestEmail) {
      return NextResponse.json(
        { success: false, error: { message: 'This lead has no email on file to send the link to' } },
        { status: 400 }
      )
    }

    const pickClassUrl = `${getWebAppUrl()}/start/pick-class?payment_id=${id}`

    const guestResult = await sendAdminEmail('pick-class-link', {
      guestEmail,
      guestName,
      venueLabel,
      pickClassUrl,
    })

    let companionEmailSent = false
    if (companionName && companionEmail) {
      const companionResult = await sendAdminEmail('pick-class-link', {
        guestEmail: companionEmail,
        guestName: companionName,
        venueLabel,
        pickClassUrl,
      })
      companionEmailSent = companionResult.success
    }

    if (!guestResult.success) {
      return NextResponse.json(
        { success: false, error: { message: guestResult.error || 'Failed to send email' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { pickClassUrl, emailSent: true, companionEmailSent },
    })
  } catch (error) {
    console.error('[API /leads/[id]/send-booking-link]', error)
    return NextResponse.json({ success: false, error: { message: 'Server error' } }, { status: 500 })
  }
}
