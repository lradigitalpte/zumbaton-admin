import type { SupabaseClient } from '@supabase/supabase-js'
import { sendLeadFollowUpEmail } from '@/lib/admin-email'
import { renderTemplate } from '@/lib/lead-outreach-templates'
import { isWhatsAppConfigured, sendWhatsAppTemplateMessage } from '@/lib/whatsapp'
import { getSupabaseAdminClient } from '@/lib/supabase'

const MAX_ATTEMPTS = 3

function getBatchSize(): number {
  const value = Number(process.env.LEAD_OUTREACH_BATCH_SIZE || 10)
  return Number.isFinite(value) && value > 0 ? Math.min(value, 50) : 10
}

function getEmailDelayMs(): number {
  const value = Number(process.env.LEAD_OUTREACH_EMAIL_DELAY_MS || 1500)
  return Number.isFinite(value) && value >= 0 ? value : 1500
}

function getWhatsAppDelayMs(): number {
  const value = Number(process.env.LEAD_OUTREACH_WHATSAPP_DELAY_MS || 500)
  return Number.isFinite(value) && value >= 0 ? value : 500
}

export function getOutreachQueueConfig() {
  return {
    batchSize: getBatchSize(),
    emailDelayMs: getEmailDelayMs(),
    whatsappDelayMs: getWhatsAppDelayMs(),
    maxAttempts: MAX_ATTEMPTS,
    cronFrequency: 'Every 2 minutes',
  }
}

type OutreachMessage = {
  id: string
  campaign_id: string
  lead_id: string | null
  channel: 'email' | 'whatsapp'
  recipient: string
  lead_name: string
  status: string
  attempts: number
  metadata: Record<string, unknown>
}

type OutreachCampaign = {
  id: string
  email_subject: string | null
  email_body: string | null
  whatsapp_body: string | null
}

async function markMessage(
  supabase: SupabaseClient,
  messageId: string,
  update: Record<string, unknown>
) {
  await supabase.from('lead_outreach_messages').update(update).eq('id', messageId)
}

async function logLeadActivity(
  supabase: SupabaseClient,
  leadId: string,
  channel: string,
  status: string,
  campaignId: string
) {
  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: 'outreach_sent',
    note: `${channel} follow-up ${status}`,
    new_values: { channel, status, campaignId },
  })
}

async function processMessage(
  supabase: SupabaseClient,
  message: OutreachMessage,
  campaign: OutreachCampaign
) {
  await markMessage(supabase, message.id, { status: 'sending', attempts: message.attempts + 1 })

  if (message.channel === 'email') {
    const subject = renderTemplate(campaign.email_subject || '', { name: message.lead_name })
    const body = renderTemplate(campaign.email_body || '', { name: message.lead_name })
    const result = await sendLeadFollowUpEmail(message.recipient, message.lead_name, subject, body)

    if (result.success) {
      await markMessage(supabase, message.id, {
        status: 'sent',
        provider_message_id: result.messageId || null,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      if (message.lead_id) {
        await logLeadActivity(supabase, message.lead_id, 'email', 'sent', campaign.id)
        await supabase.from('marketing_leads').update({
          last_contacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', message.lead_id)
      }
      return { sent: true, failed: false, skipped: false }
    }

    const attempts = message.attempts + 1
    const finalStatus = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
    await markMessage(supabase, message.id, {
      status: finalStatus,
      error_message: result.error || 'Email send failed',
      attempts,
    })
    return { sent: false, failed: finalStatus === 'failed', skipped: false }
  }

  if (message.channel === 'whatsapp') {
    if (!isWhatsAppConfigured()) {
      await markMessage(supabase, message.id, {
        status: 'skipped',
        error_message: 'WhatsApp API not configured',
        sent_at: new Date().toISOString(),
      })
      return { sent: false, failed: false, skipped: true }
    }

    const bodyPreview = renderTemplate(campaign.whatsapp_body || '', { name: message.lead_name })
    const result = await sendWhatsAppTemplateMessage(message.recipient, message.lead_name, bodyPreview)

    if (result.success) {
      await markMessage(supabase, message.id, {
        status: 'sent',
        provider_message_id: result.messageId || null,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      if (message.lead_id) {
        await logLeadActivity(supabase, message.lead_id, 'whatsapp', 'sent', campaign.id)
        await supabase.from('marketing_leads').update({
          last_contacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', message.lead_id)
      }
      return { sent: true, failed: false, skipped: false }
    }

    const attempts = message.attempts + 1
    const finalStatus = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
    await markMessage(supabase, message.id, {
      status: finalStatus,
      error_message: result.error || 'WhatsApp send failed',
      attempts,
    })
    return { sent: false, failed: finalStatus === 'failed', skipped: false }
  }

  await markMessage(supabase, message.id, { status: 'skipped', error_message: 'Unknown channel' })
  return { sent: false, failed: false, skipped: true }
}

async function refreshCampaignStats(supabase: SupabaseClient, campaignId: string) {
  const { data: messages } = await supabase
    .from('lead_outreach_messages')
    .select('status')
    .eq('campaign_id', campaignId)

  const rows = messages || []
  const sent = rows.filter((r) => ['sent', 'delivered'].includes(r.status)).length
  const failed = rows.filter((r) => r.status === 'failed').length
  const skipped = rows.filter((r) => r.status === 'skipped').length
  const pending = rows.filter((r) => ['pending', 'sending'].includes(r.status)).length

  const status = pending > 0 ? 'processing' : 'completed'
  await supabase.from('lead_outreach_campaigns').update({
    sent_count: sent,
    failed_count: failed,
    skipped_count: skipped,
    status,
    completed_at: pending === 0 ? new Date().toISOString() : null,
  }).eq('id', campaignId)
}

export async function processLeadOutreachQueue(campaignId?: string): Promise<{
  processed: number
  sent: number
  failed: number
  skipped: number
}> {
  const supabase = getSupabaseAdminClient()
  const batchSize = getBatchSize()

  let query = supabase
    .from('lead_outreach_messages')
    .select('id, campaign_id, lead_id, channel, recipient, lead_name, status, attempts, metadata')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (campaignId) {
    query = query.eq('campaign_id', campaignId)
  }

  const { data: pending, error } = await query

  if (error) throw error
  if (!pending?.length) return { processed: 0, sent: 0, failed: 0, skipped: 0 }

  const campaignIds = [...new Set(pending.map((m) => m.campaign_id))]
  const { data: campaigns } = await supabase
    .from('lead_outreach_campaigns')
    .select('id, email_subject, email_body, whatsapp_body')
    .in('id', campaignIds)

  const campaignMap = new Map((campaigns || []).map((c) => [c.id, c as OutreachCampaign]))

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const message of pending as OutreachMessage[]) {
    const campaign = campaignMap.get(message.campaign_id)
    if (!campaign) {
      await markMessage(supabase, message.id, { status: 'failed', error_message: 'Campaign not found' })
      failed++
      continue
    }

    const result = await processMessage(supabase, message, campaign)
    if (result.sent) sent++
    if (result.failed) failed++
    if (result.skipped) skipped++

    const delayMs = message.channel === 'whatsapp' ? getWhatsAppDelayMs() : getEmailDelayMs()
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  for (const campaignId of campaignIds) {
    await refreshCampaignStats(supabase, campaignId)
  }

  return { processed: pending.length, sent, failed, skipped }
}

/** Reset failed (and stuck sending) messages, then process the queue for one campaign. */
export async function retryFailedCampaignMessages(campaignId: string) {
  const supabase = getSupabaseAdminClient()

  await supabase
    .from('lead_outreach_messages')
    .update({ status: 'pending', error_message: null })
    .eq('campaign_id', campaignId)
    .eq('status', 'sending')
    .lt('attempts', MAX_ATTEMPTS)

  const { data: resetRows, error } = await supabase
    .from('lead_outreach_messages')
    .update({ status: 'pending', attempts: 0, error_message: null })
    .eq('campaign_id', campaignId)
    .eq('status', 'failed')
    .select('id')

  if (error) throw error

  await supabase.from('lead_outreach_campaigns').update({
    status: 'processing',
    completed_at: null,
  }).eq('id', campaignId)

  const queueResult = await processLeadOutreachQueue(campaignId)

  return {
    resetCount: resetRows?.length || 0,
    ...queueResult,
  }
}

/** Process pending messages for one campaign immediately (does not reset failed). */
export async function processCampaignQueueNow(campaignId: string) {
  const supabase = getSupabaseAdminClient()

  await supabase
    .from('lead_outreach_messages')
    .update({ status: 'pending', error_message: null })
    .eq('campaign_id', campaignId)
    .eq('status', 'sending')
    .lt('attempts', MAX_ATTEMPTS)

  await supabase.from('lead_outreach_campaigns').update({
    status: 'processing',
    completed_at: null,
  }).eq('id', campaignId)

  return processLeadOutreachQueue(campaignId)
}

export type OutreachWebhookEvent = 'delivered' | 'opened' | 'clicked' | 'failed'

export async function updateOutreachMessageFromWebhook(
  providerMessageId: string,
  event: OutreachWebhookEvent,
  errorMessage?: string
) {
  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('lead_outreach_messages')
    .select('id, status, delivered_at, opened_at, clicked_at')
    .eq('provider_message_id', providerMessageId)
    .maybeSingle()

  if (!existing) return

  const update: Record<string, unknown> = {}

  if (event === 'failed') {
    update.status = 'failed'
    if (errorMessage) update.error_message = errorMessage
  } else if (event === 'delivered') {
    if (!existing.delivered_at) update.delivered_at = now
    if (!['opened', 'clicked', 'failed'].includes(existing.status)) {
      update.status = 'delivered'
    }
  } else if (event === 'opened') {
    if (!existing.opened_at) update.opened_at = now
    if (existing.status !== 'clicked' && existing.status !== 'failed') {
      update.status = 'opened'
    }
  } else if (event === 'clicked') {
    if (!existing.clicked_at) update.clicked_at = now
    if (existing.status !== 'failed') {
      update.status = 'clicked'
    }
  }

  if (Object.keys(update).length === 0) return

  await supabase.from('lead_outreach_messages').update(update).eq('id', existing.id)
}
