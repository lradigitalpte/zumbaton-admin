import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { cleanText, LEAD_STATUSES, normalizeEmail, normalizePhone, normalizeSource, type LeadStatus } from '@/lib/leads'

export const dynamic = 'force-dynamic'

async function requireStaff(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return { error: NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 }) }
  if (!['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
    return { error: NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 }) }
  }
  return { user }
}

function mapMarketingLead(row: Record<string, any>) {
  return {
    kind: 'marketing' as const,
    id: row.id, createdAt: row.submitted_at || row.created_at, submittedAt: row.submitted_at || '', importedAt: row.created_at, updatedAt: row.updated_at,
    name: row.name || 'Unknown', email: row.email || '', phone: row.phone || '',
    source: row.source, platform: row.platform || row.source, status: row.status,
    archived: Boolean(row.archived_at), archivedAt: row.archived_at || '',
    starred: Boolean(row.is_starred), starredAt: row.starred_at || '',
    assignedTo: row.assigned_to || '', assignedName: row.assignee?.name || '',
    nextFollowUpAt: row.next_follow_up_at || '', lastContactedAt: row.last_contacted_at || '',
    notes: row.notes || '', lostReason: row.lost_reason || '', campaignName: row.campaign_name || '',
    adsetName: row.adset_name || '', adName: row.ad_name || '', formName: row.form_name || '',
    externalId: row.external_id || '', importedFrom: row.imported_from || '', rawFormData: row.raw_form_data || {},
    paymentStatus: '', provider: '', promoLabel: '', paymentTerms: '', preferredNote: '',
    fullAmount: 0, chargedAmount: 0, balance: 0, amount: 0, bookedClassTitle: '', bookedClassAt: '',
  }
}

function mapQuickJoin(row: Record<string, any>) {
  const m = row.metadata || {}
  const legacyStatus: Record<string, LeadStatus> = { new: 'new', contacted: 'contacted', scheduled: 'trial_scheduled', done: 'converted' }
  return {
    kind: 'quick_join' as const,
    id: row.id, createdAt: row.created_at, submittedAt: row.created_at, importedAt: row.created_at, updatedAt: row.updated_at,
    name: m.guest_name || 'Guest', email: m.guest_email || '', phone: m.guest_phone || '',
    source: 'website', platform: 'website', status: legacyStatus[m.lead_status] || 'new',
    archived: false, archivedAt: '',
    starred: false, starredAt: '',
    assignedTo: '', assignedName: '', nextFollowUpAt: '', lastContactedAt: '', notes: m.preferred_note || '', lostReason: '',
    campaignName: '', adsetName: '', adName: '', formName: '', externalId: '', importedFrom: '/start', rawFormData: m,
    paymentStatus: row.status || 'pending', provider: row.provider || '', promoLabel: m.promo_label || '1-for-1',
    paymentTerms: m.payment_terms || 'full', preferredNote: m.preferred_note || '',
    fullAmount: Number(m.full_amount_cents || 0) / 100, chargedAmount: Number(m.charged_amount_cents || 0) / 100,
    balance: Number(m.balance_cents || 0) / 100, amount: Number(row.amount_cents || 0) / 100,
    bookedClassTitle: m.booked_class_title || '', bookedClassAt: m.booked_class_at || '',
  }
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireStaff(request)
    if (gate.error) return gate.error
    const supabase = getSupabaseAdminClient()
    const [marketing, quickJoin, staff] = await Promise.all([
      supabase.from('marketing_leads').select('*, assignee:user_profiles!marketing_leads_assigned_to_fkey(name)').order('created_at', { ascending: false }).limit(1000),
      supabase.from('payments').select('id, created_at, updated_at, amount_cents, status, provider, metadata')
        .or('metadata->>flow_type.eq.quick_join,and(metadata->>flow_type.eq.quick_trial,metadata->>needs_scheduling.eq.true)')
        .order('created_at', { ascending: false }).limit(500),
      supabase.from('user_profiles').select('id, name, role').in('role', ['super_admin', 'admin', 'staff', 'receptionist']).eq('is_active', true).order('name'),
    ])
    if (marketing.error) throw marketing.error
    if (quickJoin.error) throw quickJoin.error
    const leads = [...(marketing.data || []).map(mapMarketingLead), ...(quickJoin.data || []).map(mapQuickJoin)]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return NextResponse.json({ success: true, data: { leads, staff: staff.data || [] } })
  } catch (error) {
    console.error('[API /leads GET]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to fetch leads. Has the CRM migration been applied?' } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireStaff(request)
    if (gate.error) return gate.error
    const body = await request.json()
    const name = cleanText(body.name) || ''
    const phone = cleanText(body.phone)
    const email = cleanText(body.email)
    if (!name || (!phone && !email)) return NextResponse.json({ success: false, error: { message: 'Name and phone or email are required' } }, { status: 400 })
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase.from('marketing_leads').insert({
      source: normalizeSource(body.source || 'manual'), platform: cleanText(body.platform) || 'manual', name, phone,
      normalized_phone: normalizePhone(phone), email, normalized_email: normalizeEmail(email), notes: cleanText(body.notes) || '',
      assigned_to: cleanText(body.assignedTo), next_follow_up_at: cleanText(body.nextFollowUpAt), created_by: gate.user!.id,
      raw_form_data: body,
    }).select('*').single()
    if (error) throw error
    await supabase.from('lead_activities').insert({ lead_id: data.id, actor_id: gate.user!.id, activity_type: 'created', new_values: body })
    return NextResponse.json({ success: true, data: mapMarketingLead(data) }, { status: 201 })
  } catch (error) {
    console.error('[API /leads POST]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to create lead' } }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const gate = await requireStaff(request)
    if (gate.error) return gate.error
    const body = await request.json()
    if (!body.id) return NextResponse.json({ success: false, error: { message: 'Missing lead id' } }, { status: 400 })
    const supabase = getSupabaseAdminClient()

    if (body.kind === 'quick_join') {
      const legacy: Partial<Record<LeadStatus, string>> = { new: 'new', contacted: 'contacted', trial_scheduled: 'scheduled', converted: 'done' }
      const { data: existing } = await supabase.from('payments').select('metadata').eq('id', body.id).single()
      if (!existing) return NextResponse.json({ success: false, error: { message: 'Lead not found' } }, { status: 404 })
      const metadata = { ...(existing.metadata || {}) }
      if (body.status && legacy[body.status as LeadStatus]) metadata.lead_status = legacy[body.status as LeadStatus]
      if (typeof body.name === 'string') metadata.guest_name = body.name.trim()
      if (typeof body.phone === 'string') metadata.guest_phone = body.phone.trim()
      if (typeof body.email === 'string') metadata.guest_email = body.email.trim().toLowerCase()
      if (typeof body.notes === 'string') metadata.preferred_note = body.notes.trim()
      const { error } = await supabase.from('payments').update({ metadata, updated_at: new Date().toISOString() }).eq('id', body.id)
      if (error) throw error
      return NextResponse.json({ success: true, data: { id: body.id } })
    }

    const allowed: Record<string, string> = {
      name: 'name', phone: 'phone', email: 'email', status: 'status', assignedTo: 'assigned_to', nextFollowUpAt: 'next_follow_up_at',
      notes: 'notes', lostReason: 'lost_reason', campaignName: 'campaign_name', formName: 'form_name', submittedAt: 'submitted_at',
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const [input, column] of Object.entries(allowed)) if (Object.prototype.hasOwnProperty.call(body, input)) updates[column] = cleanText(body[input])
    if (body.status) {
      if (!LEAD_STATUSES.includes(body.status)) return NextResponse.json({ success: false, error: { message: 'Invalid status' } }, { status: 400 })
      updates.status = body.status
      if (['contacted', 'attempted_contact'].includes(body.status)) updates.last_contacted_at = new Date().toISOString()
      if (body.status === 'converted') updates.converted_at = new Date().toISOString()
    }
    if ('phone' in body) updates.normalized_phone = normalizePhone(body.phone)
    if ('email' in body) updates.normalized_email = normalizeEmail(body.email)
    if (typeof body.starred === 'boolean') {
      updates.is_starred = body.starred
      updates.starred_at = body.starred ? new Date().toISOString() : null
      updates.starred_by = body.starred ? gate.user!.id : null
    }
    const { data, error } = await supabase.from('marketing_leads').update(updates).eq('id', body.id).select('*').single()
    if (error) throw error
    const activityType = body.status ? 'status_changed' : body.notes ? 'note_added' : body.assignedTo ? 'assigned' : body.nextFollowUpAt ? 'follow_up_set' : 'updated'
    await supabase.from('lead_activities').insert({ lead_id: body.id, actor_id: gate.user!.id, activity_type: activityType, new_values: updates, note: cleanText(body.activityNote) })
    return NextResponse.json({ success: true, data: mapMarketingLead(data) })
  } catch (error) {
    console.error('[API /leads PUT]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to update lead' } }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requireStaff(request)
  if (gate.error) return gate.error
  const id = new URL(request.url).searchParams.get('id')
  const kind = new URL(request.url).searchParams.get('kind')
  if (!id || kind !== 'marketing') return NextResponse.json({ success: false, error: { message: 'Only marketing leads can be deleted here' } }, { status: 400 })
  const { error } = await getSupabaseAdminClient().from('marketing_leads').delete().eq('id', id)
  if (error) return NextResponse.json({ success: false, error: { message: 'Failed to delete lead' } }, { status: 500 })
  return NextResponse.json({ success: true, data: { id } })
}
