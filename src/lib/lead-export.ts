import type { SupabaseClient } from '@supabase/supabase-js'

export type LeadExportRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  normalized_phone: string | null
  normalized_email: string | null
  source: string
  status: string
  campaign_name: string | null
  submitted_at: string | null
  created_at: string
  archived_at: string | null
}

export function channelSources(channel: string): string[] | null {
  if (channel === 'meta') return ['meta', 'facebook', 'instagram']
  if (channel === 'tiktok') return ['tiktok']
  if (channel === 'website') return ['website', 'google_sheets']
  if (channel === 'manual') return ['manual']
  if (channel === 'other') return ['other']
  return null
}

export function filterLeads(rows: LeadExportRow[], params: URLSearchParams): LeadExportRow[] {
  const status = params.get('status')
  const channel = params.get('channel')
  const search = params.get('search')?.trim().toLowerCase()
  const visibility = params.get('visibility') || 'active'
  const hasEmail = params.get('hasEmail') === 'true'
  const hasPhone = params.get('hasPhone') === 'true'
  const dateFrom = params.get('dateFrom')
  const dateTo = params.get('dateTo')
  const ids = params.get('ids')?.split(',').filter(Boolean)

  const channelList = channel && channel !== 'all' ? channelSources(channel) : null

  return rows.filter((lead) => {
    if (ids?.length && !ids.includes(lead.id)) return false
    if (visibility === 'active' && lead.archived_at) return false
    if (visibility === 'archived' && !lead.archived_at) return false
    if (status && status !== 'all' && lead.status !== status) return false
    if (channelList && !channelList.includes(lead.source)) return false
    if (hasEmail && !lead.email) return false
    if (hasPhone && !lead.phone) return false

    const leadTime = new Date(lead.submitted_at || lead.created_at).getTime()
    if (dateFrom && leadTime < new Date(`${dateFrom}T00:00:00`).getTime()) return false
    if (dateTo && leadTime > new Date(`${dateTo}T23:59:59.999`).getTime()) return false

    if (search) {
      const haystack = [lead.name, lead.phone, lead.email, lead.campaign_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

export function dedupeBy<T>(rows: T[], keyFn: (row: T) => string | null): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const row of rows) {
    const key = keyFn(row)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

export function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsv).join(',')]
  for (const row of rows) lines.push(row.map((cell) => escapeCsv(cell)).join(','))
  return lines.join('\n')
}

export function exportCounts(leads: LeadExportRow[]) {
  const withPhone = leads.filter((l) => l.phone)
  const withEmail = leads.filter((l) => l.email)
  return {
    total: leads.length,
    withPhone: withPhone.length,
    withEmail: withEmail.length,
    uniquePhones: dedupeBy(withPhone, (l) => l.normalized_phone).length,
    uniqueEmails: dedupeBy(withEmail, (l) => l.normalized_email).length,
  }
}

export function filtersFromRecord(filters: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  return params
}

export async function fetchFilteredMarketingLeads(
  supabase: SupabaseClient,
  searchParams: URLSearchParams
): Promise<LeadExportRow[]> {
  const { data, error } = await supabase
    .from('marketing_leads')
    .select('id, name, phone, email, normalized_phone, normalized_email, source, status, campaign_name, submitted_at, created_at, archived_at')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) throw error
  return filterLeads((data || []) as LeadExportRow[], searchParams)
}
