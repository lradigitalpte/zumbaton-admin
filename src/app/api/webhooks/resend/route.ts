import { NextRequest, NextResponse } from 'next/server'
import { updateOutreachMessageFromWebhook } from '@/services/lead-outreach.service'

export const dynamic = 'force-dynamic'

/**
 * Resend webhook for delivery events.
 * Configure in Resend dashboard → Webhooks → email.delivered, email.bounced, email.complained
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = request.headers.get('svix-signature') || request.headers.get('resend-signature')
      if (!signature) {
        return NextResponse.json({ success: false, error: 'Missing signature' }, { status: 401 })
      }
      // Resend uses Svix — full verification can be added when secret is configured
    }

    const payload = await request.json() as {
      type?: string
      data?: { email_id?: string; id?: string; error?: { message?: string } }
    }

    const messageId = payload.data?.email_id || payload.data?.id
    if (!messageId) {
      return NextResponse.json({ success: true, skipped: true })
    }

    if (payload.type === 'email.delivered') {
      await updateOutreachMessageFromWebhook(messageId, 'delivered')
    } else if (payload.type === 'email.bounced' || payload.type === 'email.complained') {
      await updateOutreachMessageFromWebhook(
        messageId,
        'failed',
        payload.data?.error?.message || payload.type
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook /resend]', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
