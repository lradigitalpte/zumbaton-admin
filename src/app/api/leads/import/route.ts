import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { mapIncomingLead } from '@/lib/leads'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin'].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: 'Only administrators can import leads' } }, { status: 403 })
  }
  try {
    const body = await request.json()
    const records: Record<string, unknown>[] = Array.isArray(body.records) ? body.records : []
    const filename = String(body.filename || 'dashboard-upload.csv').slice(0, 255)
    if (!records.length || records.length > 500) {
      return NextResponse.json({ success: false, error: { message: 'Each import must contain between 1 and 500 rows' } }, { status: 400 })
    }
    const rows = records.map((record) => mapIncomingLead(record, filename))
    const valid = rows.filter((row) => row.name && (row.phone || row.email))
    const skippedInvalid = rows.length - valid.length
    const withExternal = valid.filter((row) => row.external_id)
    const withoutExternal = valid.filter((row) => !row.external_id)
    const supabase = getSupabaseAdminClient()
    const insertedIds: string[] = []
    if (withExternal.length) {
      const { data, error } = await supabase.from('marketing_leads').upsert(withExternal, { onConflict: 'source,external_id', ignoreDuplicates: true }).select('id')
      if (error) throw error
      insertedIds.push(...(data || []).map((row) => row.id))
    }
    // Rows without a platform ID cannot be safely upserted; avoid obvious phone/email duplicates.
    for (const row of withoutExternal) {
      let duplicate = false
      if (row.normalized_phone) {
        const { data } = await supabase.from('marketing_leads').select('id').eq('normalized_phone', row.normalized_phone).limit(1)
        duplicate = Boolean(data?.length)
      }
      if (!duplicate && row.normalized_email) {
        const { data } = await supabase.from('marketing_leads').select('id').eq('normalized_email', row.normalized_email).limit(1)
        duplicate = Boolean(data?.length)
      }
      if (!duplicate) {
        const { data, error } = await supabase.from('marketing_leads').insert(row).select('id').single()
        if (error) throw error
        insertedIds.push(data.id)
      }
    }
    if (insertedIds.length) await supabase.from('lead_activities').insert(insertedIds.map((id) => ({ lead_id: id, actor_id: user.id, activity_type: 'imported', note: `Imported from ${filename}` })))
    return NextResponse.json({ success: true, data: { received: rows.length, inserted: insertedIds.length, duplicates: valid.length - insertedIds.length, skippedInvalid } })
  } catch (error) {
    console.error('[API /leads/import]', error)
    return NextResponse.json({ success: false, error: { message: 'CSV import failed' } }, { status: 500 })
  }
}
