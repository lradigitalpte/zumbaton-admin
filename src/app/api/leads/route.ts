/**
 * Leads API (pay-first / quick-join leads)
 * GET    /api/leads  - list leads captured from the /start page
 * PUT    /api/leads  - update a lead's status and/or editable details
 * DELETE /api/leads  - delete a lead (and any booking created from it)
 *
 * Leads are stored as `payments` rows with metadata.flow_type = 'quick_join'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const LEAD_STATUSES = ['new', 'contacted', 'scheduled', 'done'] as const
type LeadStatus = (typeof LEAD_STATUSES)[number]

function cents(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function mapLead(p: Record<string, any>) {
  const m = (p.metadata as Record<string, any>) || {}
  return {
    id: p.id as string,
    createdAt: p.created_at as string,
    name: (m.guest_name as string) || 'Guest',
    email: (m.guest_email as string) || '',
    phone: (m.guest_phone as string) || '',
    venue: (m.venue as string) || '',
    promoLabel: (m.promo_label as string) || '1-for-1',
    paymentTerms: (m.payment_terms as string) || 'full',
    preferredNote: (m.preferred_note as string) || '',
    fullAmount: cents(m.full_amount_cents) / 100,
    chargedAmount: cents(m.charged_amount_cents) / 100,
    balance: cents(m.balance_cents) / 100,
    amount: cents(p.amount_cents) / 100,
    provider: (p.provider as string) || '',
    paymentStatus: (p.status as string) || 'pending',
    leadStatus: (m.lead_status as LeadStatus) || 'new',
    bookedClassTitle: (m.booked_class_title as string) || '',
    bookedClassAt: (m.booked_class_at as string) || '',
  }
}

async function requireAdmin(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return { error: NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 }) }
  if (!['super_admin', 'admin'].includes(user.role)) {
    return { error: NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 }) }
  }
  return { user }
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireAdmin(request)
    if (gate.error) return gate.error

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('payments')
      .select('id, created_at, amount_cents, currency, status, provider, metadata')
      .eq('metadata->>flow_type', 'quick_join')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('[API /leads] Supabase error:', error)
      return NextResponse.json({ success: false, error: { message: 'Failed to fetch leads' } }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: (data || []).map(mapLead) })
  } catch (error) {
    console.error('[API /leads]', error)
    return NextResponse.json({ success: false, error: { message: 'Server error' } }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const gate = await requireAdmin(request)
    if (gate.error) return gate.error

    const body = await request.json()
    const id = body?.id as string | undefined
    if (!id) {
      return NextResponse.json({ success: false, error: { message: 'Missing lead id' } }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data: existing, error: fetchErr } = await supabase
      .from('payments')
      .select('id, metadata')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ success: false, error: { message: 'Lead not found' } }, { status: 404 })
    }

    const metadata: Record<string, any> = { ...((existing.metadata as Record<string, any>) || {}) }

    // Status change
    if (typeof body.leadStatus === 'string') {
      if (!LEAD_STATUSES.includes(body.leadStatus as LeadStatus)) {
        return NextResponse.json({ success: false, error: { message: 'Invalid status' } }, { status: 400 })
      }
      metadata.lead_status = body.leadStatus
    }

    // Editable detail fields
    if (typeof body.name === 'string') metadata.guest_name = body.name.trim()
    if (typeof body.phone === 'string') metadata.guest_phone = body.phone.trim()
    if (typeof body.email === 'string') metadata.guest_email = body.email.trim().toLowerCase()
    if (typeof body.preferredNote === 'string') metadata.preferred_note = body.preferredNote.trim()

    const { error: updateErr } = await supabase
      .from('payments')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateErr) {
      console.error('[API /leads PUT] Supabase error:', updateErr)
      return NextResponse.json({ success: false, error: { message: 'Failed to update lead' } }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[API /leads PUT]', error)
    return NextResponse.json({ success: false, error: { message: 'Server error' } }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireAdmin(request)
    if (gate.error) return gate.error

    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: { message: 'Missing lead id' } }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    // Remove any booking created from this lead first (FK payment_id set null on delete otherwise)
    await supabase.from('bookings').delete().eq('payment_id', id)
    const { error } = await supabase.from('payments').delete().eq('id', id)

    if (error) {
      console.error('[API /leads DELETE] Supabase error:', error)
      return NextResponse.json({ success: false, error: { message: 'Failed to delete lead' } }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[API /leads DELETE]', error)
    return NextResponse.json({ success: false, error: { message: 'Server error' } }, { status: 500 })
  }
}
