import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { mapIncomingLead } from '@/lib/leads'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.LEADS_INGEST_SECRET
  const suppliedSecret = request.headers.get('x-leads-ingest-secret')
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  }
  try {
    const body = await request.json()
    const records = Array.isArray(body) ? body : Array.isArray(body.leads) ? body.leads : [body]
    if (!records.length || records.length > 500) return NextResponse.json({ success: false, error: { message: 'Send between 1 and 500 leads' } }, { status: 400 })
    const importedFrom = request.headers.get('x-leads-source') || 'api'
    const rows: ReturnType<typeof mapIncomingLead>[] = records.map((record: Record<string, unknown>) => mapIncomingLead(record, importedFrom))
    const invalid = rows.filter((row: ReturnType<typeof mapIncomingLead>) => !row.name || (!row.phone && !row.email))
    if (invalid.length) return NextResponse.json({ success: false, error: { message: `${invalid.length} lead(s) are missing a name and contact method` } }, { status: 400 })
    const supabase = getSupabaseAdminClient()
    const withExternal = rows.filter((row: ReturnType<typeof mapIncomingLead>) => row.external_id)
    const withoutExternal = rows.filter((row: ReturnType<typeof mapIncomingLead>) => !row.external_id)
    const results: any[] = []
    if (withExternal.length) {
      const { data, error } = await supabase.from('marketing_leads').upsert(withExternal, { onConflict: 'source,external_id', ignoreDuplicates: true }).select('id')
      if (error) throw error
      results.push(...(data || []))
    }
    if (withoutExternal.length) {
      const { data, error } = await supabase.from('marketing_leads').insert(withoutExternal).select('id')
      if (error) throw error
      results.push(...(data || []))
    }
    if (results.length) await supabase.from('lead_activities').insert(results.map((row) => ({ lead_id: row.id, activity_type: 'imported', note: `Imported from ${importedFrom}` })))
    return NextResponse.json({ success: true, data: { received: rows.length, inserted: results.length, duplicates: rows.length - results.length } })
  } catch (error) {
    console.error('[API /leads/ingest]', error)
    return NextResponse.json({ success: false, error: { message: 'Lead import failed' } }, { status: 500 })
  }
}
