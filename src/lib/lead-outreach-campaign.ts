import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdminClient } from '@/lib/supabase'
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_WHATSAPP_BODY,
} from '@/lib/lead-outreach-templates'
import { filtersFromRecord, fetchFilteredMarketingLeads } from '@/lib/lead-export'
import { processLeadOutreachQueue } from '@/services/lead-outreach.service'

export const MAX_LEADS_PER_CAMPAIGN = 500

type LeadRow = { id: string; name: string; phone: string | null; email: string | null; archived_at: string | null }

function buildMessageRows(
  activeLeads: LeadRow[],
  sendEmail: boolean,
  sendWhatsApp: boolean
) {
  const messageRows: Array<{
    lead_id: string
    channel: 'email' | 'whatsapp'
    recipient: string
    lead_name: string
    status: 'pending' | 'skipped'
    error_message?: string
  }> = []

  for (const lead of activeLeads) {
    if (sendEmail) {
      if (lead.email) {
        messageRows.push({
          lead_id: lead.id,
          channel: 'email',
          recipient: lead.email,
          lead_name: lead.name || 'there',
          status: 'pending',
        })
      } else {
        messageRows.push({
          lead_id: lead.id,
          channel: 'email',
          recipient: '',
          lead_name: lead.name || 'there',
          status: 'skipped',
          error_message: 'No email on file',
        })
      }
    }
    if (sendWhatsApp) {
      if (lead.phone) {
        messageRows.push({
          lead_id: lead.id,
          channel: 'whatsapp',
          recipient: lead.phone,
          lead_name: lead.name || 'there',
          status: 'pending',
        })
      } else {
        messageRows.push({
          lead_id: lead.id,
          channel: 'whatsapp',
          recipient: '',
          lead_name: lead.name || 'there',
          status: 'skipped',
          error_message: 'No phone on file',
        })
      }
    }
  }

  return messageRows
}

export async function createLeadOutreachCampaign(options: {
  userId: string
  marketingIds: string[]
  channels: string[]
  emailSubject?: string
  emailBody?: string
  whatsappBody?: string
  name?: string
  templateId?: string | null
  filters?: Record<string, unknown>
}) {
  const supabase = getSupabaseAdminClient()
  const sendEmail = options.channels.includes('email')
  const sendWhatsApp = options.channels.includes('whatsapp')

  if (!sendEmail && !sendWhatsApp) {
    throw new Error('Select email and/or WhatsApp')
  }

  const marketingIds = options.marketingIds.slice(0, MAX_LEADS_PER_CAMPAIGN)
  if (!marketingIds.length) {
    throw new Error('Select at least one lead')
  }

  const { data: leads, error: leadsError } = await supabase
    .from('marketing_leads')
    .select('id, name, phone, email, archived_at')
    .in('id', marketingIds)

  if (leadsError) throw leadsError

  const activeLeads = (leads || []).filter((l) => !l.archived_at) as LeadRow[]
  const emailSubject = String(options.emailSubject || DEFAULT_EMAIL_SUBJECT).slice(0, 200)
  const emailBody = String(options.emailBody || DEFAULT_EMAIL_BODY).slice(0, 10000)
  const whatsappBody = String(options.whatsappBody || DEFAULT_WHATSAPP_BODY).slice(0, 1000)
  const campaignName = String(options.name || `Follow-up ${new Date().toLocaleDateString('en-SG')}`).slice(0, 120)
  const selectedChannels = [sendEmail && 'email', sendWhatsApp && 'whatsapp'].filter(Boolean) as string[]

  const messageRows = buildMessageRows(activeLeads, sendEmail, sendWhatsApp)
  if (!messageRows.length) {
    throw new Error('No sendable messages for selected leads')
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('lead_outreach_campaigns')
    .insert({
      name: campaignName,
      channels: selectedChannels,
      email_subject: sendEmail ? emailSubject : null,
      email_body: sendEmail ? emailBody : null,
      whatsapp_body: sendWhatsApp ? whatsappBody : null,
      whatsapp_template: process.env.WHATSAPP_TEMPLATE_NAME || null,
      template_id: options.templateId || null,
      filters: options.filters || { leadIds: marketingIds },
      status: 'queued',
      total_count: messageRows.length,
      created_by: options.userId,
    })
    .select('id')
    .single()

  if (campaignError) throw campaignError

  const { error: messagesError } = await supabase.from('lead_outreach_messages').insert(
    messageRows.map((row) => ({
      campaign_id: campaign.id,
      lead_id: row.lead_id,
      channel: row.channel,
      recipient: row.recipient,
      lead_name: row.lead_name,
      status: row.status,
      error_message: row.error_message || null,
      sent_at: row.status === 'skipped' ? new Date().toISOString() : null,
    }))
  )

  if (messagesError) throw messagesError

  const queueResult = await processLeadOutreachQueue()

  return {
    campaignId: campaign.id,
    queued: messageRows.filter((r) => r.status === 'pending').length,
    skipped: messageRows.filter((r) => r.status === 'skipped').length,
    processed: queueResult,
  }
}

export async function resolveMarketingIdsFromFilters(
  supabase: SupabaseClient,
  filters: Record<string, string>
): Promise<string[]> {
  const params = filtersFromRecord(filters)
  const rows = await fetchFilteredMarketingLeads(supabase, params)
  if (rows.length > MAX_LEADS_PER_CAMPAIGN) {
    throw new Error(`Segment has ${rows.length} leads. Narrow filters or send in batches (max ${MAX_LEADS_PER_CAMPAIGN}).`)
  }
  return rows.map((row) => row.id)
}
