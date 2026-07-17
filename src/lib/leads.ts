export const LEAD_STATUSES = [
  'new', 'attempted_contact', 'contacted', 'follow_up', 'trial_scheduled',
  'trial_attended', 'converted', 'not_interested', 'unreachable', 'cold',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export function normalizeLeadStatus(value: unknown): LeadStatus {
  const status = String(value ?? '').trim().toLowerCase().replace(/[ -]+/g, '_')
  const aliases: Record<string, LeadStatus> = {
    called: 'contacted', contact: 'contacted', followup: 'follow_up', scheduled: 'trial_scheduled',
    attended: 'trial_attended', won: 'converted', completed: 'converted', done: 'converted',
    lost: 'not_interested', rejected: 'not_interested', no_answer: 'unreachable',
  }
  if ((LEAD_STATUSES as readonly string[]).includes(status)) return status as LeadStatus
  return aliases[status] || 'new'
}

export function normalizePhone(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 8) return `65${digits}`
  if (digits.startsWith('00')) return digits.slice(2)
  return digits
}

export function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase()
  return email || null
}

export function cleanText(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text || null
}

export function normalizeSource(value: unknown): string {
  const source = String(value ?? '').trim().toLowerCase()
  if (source === 'fb') return 'facebook'
  if (source === 'ig') return 'instagram'
  if (['meta', 'facebook', 'instagram', 'tiktok', 'website', 'google_sheets', 'manual'].includes(source)) return source
  return 'other'
}

export function mapIncomingLead(input: Record<string, unknown>, importedFrom?: string) {
  const platform = cleanText(input.platform)
  const source = normalizeSource(input.source || platform || (input['TikTok Lead ID'] ? 'tiktok' : 'google_sheets'))
  const name = cleanText(input.name || input.full_name || input.Name) || ''
  const phone = cleanText(input.phone || input.phone_number || input['Phone number'] || input.Number)
  const email = cleanText(input.email || input.Email)
  const submitted = cleanText(input.submitted_at || input.created_time)

  return {
    external_id: cleanText(input.external_id || input.id || input['TikTok Lead ID']),
    source,
    platform: platform?.toLowerCase() || source,
    name,
    phone,
    normalized_phone: normalizePhone(phone),
    email,
    normalized_email: normalizeEmail(email),
    status: normalizeLeadStatus(input.status || input.lead_status || input['TikTok Lead Status']),
    campaign_id: cleanText(input.campaign_id), campaign_name: cleanText(input.campaign_name),
    adset_id: cleanText(input.adset_id), adset_name: cleanText(input.adset_name),
    ad_id: cleanText(input.ad_id), ad_name: cleanText(input.ad_name),
    form_id: cleanText(input.form_id), form_name: cleanText(input.form_name),
    click_id: cleanText(input.click_id || input['Click ID']),
    submitted_at: submitted && !Number.isNaN(Date.parse(submitted)) ? new Date(submitted).toISOString() : null,
    raw_form_data: input,
    imported_from: importedFrom || null,
  }
}
