import { NextRequest, NextResponse } from 'next/server'
import { updateOutreachMessageFromWebhook } from '@/services/lead-outreach.service'

export const dynamic = 'force-dynamic'

/**
 * Meta WhatsApp Cloud API webhook for message status updates.
 * Subscribe to messages field in Meta App Dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              id: string
              status: string
              errors?: Array<{ title?: string }>
            }>
          }
        }>
      }>
    }

    const statuses = payload.entry?.[0]?.changes?.[0]?.value?.statuses || []

    for (const status of statuses) {
      if (status.status === 'delivered' || status.status === 'read') {
        await updateOutreachMessageFromWebhook(status.id, 'delivered')
      } else if (status.status === 'failed') {
        await updateOutreachMessageFromWebhook(
          status.id,
          'failed',
          status.errors?.[0]?.title || 'WhatsApp delivery failed'
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook /whatsapp]', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
