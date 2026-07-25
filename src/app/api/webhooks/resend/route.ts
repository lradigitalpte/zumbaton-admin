import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { updateOutreachMessageFromWebhook } from '@/services/lead-outreach.service'

export const dynamic = 'force-dynamic'

type ResendWebhookPayload = {
  type?: string
  data?: {
    email_id?: string
    id?: string
    error?: { message?: string }
  }
}

/**
 * Resend webhook for delivery, open, and click events.
 * Configure in Resend dashboard → Webhooks →
 * https://admin.onestepfitness.sg/api/webhooks/resend
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

    let event: ResendWebhookPayload
    if (webhookSecret) {
      const svixId = request.headers.get('svix-id')
      const svixTimestamp = request.headers.get('svix-timestamp')
      const svixSignature = request.headers.get('svix-signature')
      if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ success: false, error: 'Missing signature' }, { status: 401 })
      }

      const webhook = new Webhook(webhookSecret)
      event = webhook.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ResendWebhookPayload
    } else {
      event = JSON.parse(payload) as ResendWebhookPayload
    }

    const messageId = event.data?.email_id || event.data?.id
    if (!messageId) {
      return NextResponse.json({ success: true, skipped: true })
    }

    if (event.type === 'email.delivered') {
      await updateOutreachMessageFromWebhook(messageId, 'delivered')
    } else if (event.type === 'email.opened') {
      await updateOutreachMessageFromWebhook(messageId, 'opened')
    } else if (event.type === 'email.clicked') {
      await updateOutreachMessageFromWebhook(messageId, 'clicked')
    } else if (event.type === 'email.bounced' || event.type === 'email.complained') {
      await updateOutreachMessageFromWebhook(
        messageId,
        'failed',
        event.data?.error?.message || event.type
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook /resend]', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
