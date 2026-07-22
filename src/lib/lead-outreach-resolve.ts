import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchFilteredMarketingLeads, filtersFromRecord, type LeadExportRow } from '@/lib/lead-export'
import { resolveMarketingIdsFromFilters, MAX_LEADS_PER_CAMPAIGN } from '@/lib/lead-outreach-campaign'

export type OutreachLeadSample = {
  id: string
  name: string
  email: string
  phone: string
  canEmail: boolean
  canWhatsApp: boolean
}

export type OutreachResolveResult = {
  total: number
  eligibleEmail: number
  eligibleWhatsApp: number
  skippedNoEmail: number
  skippedNoPhone: number
  sampleLeads: OutreachLeadSample[]
  recipients: OutreachLeadSample[]
  leadIds: string[]
}

function mapLeadRow(lead: LeadExportRow): OutreachLeadSample {
  return {
    id: lead.id,
    name: lead.name || 'Unknown',
    email: lead.email || '',
    phone: lead.phone || '',
    canEmail: Boolean(lead.email),
    canWhatsApp: Boolean(lead.phone),
  }
}

export async function resolveOutreachRecipients(
  supabase: SupabaseClient,
  options: {
    leadIds?: string[]
    filters?: Record<string, string>
  }
): Promise<OutreachResolveResult> {
  let rows: LeadExportRow[] = []

  if (options.leadIds?.length) {
    const ids = options.leadIds.slice(0, MAX_LEADS_PER_CAMPAIGN)
    const { data, error } = await supabase
      .from('marketing_leads')
      .select('id, name, phone, email, normalized_phone, normalized_email, source, status, campaign_name, submitted_at, created_at, archived_at')
      .in('id', ids)

    if (error) throw error
    rows = (data || []).filter((l) => !l.archived_at) as LeadExportRow[]
  } else if (options.filters) {
    const params = filtersFromRecord(options.filters)
    rows = await fetchFilteredMarketingLeads(supabase, params)
    if (rows.length > MAX_LEADS_PER_CAMPAIGN) {
      throw new Error(`Segment has ${rows.length} leads. Narrow filters or send in batches (max ${MAX_LEADS_PER_CAMPAIGN}).`)
    }
  } else {
    throw new Error('Provide lead IDs or filters')
  }

  const samples = rows.map(mapLeadRow)
  const eligibleEmail = samples.filter((l) => l.canEmail).length
  const eligibleWhatsApp = samples.filter((l) => l.canWhatsApp).length

  return {
    total: samples.length,
    eligibleEmail,
    eligibleWhatsApp,
    skippedNoEmail: samples.length - eligibleEmail,
    skippedNoPhone: samples.length - eligibleWhatsApp,
    sampleLeads: samples.slice(0, 50),
    recipients: samples,
    leadIds: samples.map((l) => l.id),
  }
}

export async function resolveLeadIdsFromRequest(
  supabase: SupabaseClient,
  body: { items?: Array<{ id: string; kind: string }>; filters?: Record<string, string>; useFilters?: boolean }
): Promise<string[]> {
  if (body.useFilters && body.filters) {
    const filters = Object.fromEntries(
      Object.entries(body.filters).filter(([, value]) => Boolean(value))
    )
    return resolveMarketingIdsFromFilters(supabase, filters)
  }

  const items = Array.isArray(body.items) ? body.items : []
  return items.filter((i) => i.kind === 'marketing').map((i) => i.id)
}
