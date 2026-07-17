import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { cleanText, LEAD_STATUSES, type LeadStatus } from '@/lib/leads'

type BulkItem = { id: string; kind: 'marketing' | 'quick_join' }

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  try {
    const body = await request.json()
    const items: BulkItem[] = Array.isArray(body.items) ? body.items.slice(0, 1000) : []
    const action = String(body.action || '')
    if (!items.length) return NextResponse.json({ success: false, error: { message: 'Select at least one lead' } }, { status: 400 })
    if (action === 'delete' && !['super_admin', 'admin'].includes(user.role)) return NextResponse.json({ success: false, error: { message: 'Only administrators can permanently delete leads' } }, { status: 403 })
    const supabase = getSupabaseAdminClient()
    const marketingIds = items.filter((item) => item.kind === 'marketing').map((item) => item.id)
    const quickJoinIds = items.filter((item) => item.kind === 'quick_join').map((item) => item.id)
    let affected = 0

    if (action === 'status') {
      const status = body.value as LeadStatus
      if (!LEAD_STATUSES.includes(status)) return NextResponse.json({ success: false, error: { message: 'Invalid status' } }, { status: 400 })
      if (marketingIds.length) {
        const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
        if (['contacted', 'attempted_contact'].includes(status)) updates.last_contacted_at = new Date().toISOString()
        if (status === 'converted') updates.converted_at = new Date().toISOString()
        const { error } = await supabase.from('marketing_leads').update(updates).in('id', marketingIds)
        if (error) throw error
        affected += marketingIds.length
        await supabase.from('lead_activities').insert(marketingIds.map((id) => ({ lead_id: id, actor_id: user.id, activity_type: 'status_changed', new_values: { status }, note: 'Bulk status update' })))
      }
      const legacy: Partial<Record<LeadStatus, string>> = { new: 'new', contacted: 'contacted', trial_scheduled: 'scheduled', converted: 'done' }
      if (quickJoinIds.length && legacy[status]) {
        for (const id of quickJoinIds) {
          const { data } = await supabase.from('payments').select('metadata').eq('id', id).single()
          if (data) await supabase.from('payments').update({ metadata: { ...(data.metadata || {}), lead_status: legacy[status] }, updated_at: new Date().toISOString() }).eq('id', id)
        }
        affected += quickJoinIds.length
      }
    } else if (action === 'assign' || action === 'follow_up') {
      if (!marketingIds.length) return NextResponse.json({ success: false, error: { message: 'This action applies to marketing leads only' } }, { status: 400 })
      const updates = action === 'assign' ? { assigned_to: cleanText(body.value), updated_at: new Date().toISOString() } : { next_follow_up_at: cleanText(body.value), updated_at: new Date().toISOString() }
      const { error } = await supabase.from('marketing_leads').update(updates).in('id', marketingIds)
      if (error) throw error
      affected = marketingIds.length
    } else if (action === 'archive' || action === 'restore') {
      if (!marketingIds.length) return NextResponse.json({ success: false, error: { message: 'Only marketing leads can be archived' } }, { status: 400 })
      const { error } = await supabase.from('marketing_leads').update(action === 'archive' ? { archived_at: new Date().toISOString(), archived_by: user.id } : { archived_at: null, archived_by: null }).in('id', marketingIds)
      if (error) throw error
      affected = marketingIds.length
    } else if (action === 'delete') {
      if (!marketingIds.length) return NextResponse.json({ success: false, error: { message: 'Only marketing leads can be permanently deleted' } }, { status: 400 })
      const { error } = await supabase.from('marketing_leads').delete().in('id', marketingIds)
      if (error) throw error
      affected = marketingIds.length
    } else return NextResponse.json({ success: false, error: { message: 'Invalid bulk action' } }, { status: 400 })

    return NextResponse.json({ success: true, data: { affected, skipped: items.length - affected } })
  } catch (error) {
    console.error('[API /leads/bulk]', error)
    return NextResponse.json({ success: false, error: { message: 'Bulk update failed' } }, { status: 500 })
  }
}
