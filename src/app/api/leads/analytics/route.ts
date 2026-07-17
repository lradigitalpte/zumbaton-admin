import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

const channel = (source: string) => ['meta', 'facebook', 'instagram'].includes(source) ? 'Meta' : source === 'tiktok' ? 'TikTok' : source === 'website' ? 'Website' : source === 'manual' ? 'Manual' : 'Other'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  try {
    const params = new URL(request.url).searchParams
    const from = params.get('from'); const to = params.get('to'); const sourceFilter = params.get('source')
    const supabase = getSupabaseAdminClient()
    let marketing = await supabase.from('marketing_leads').select('id, source, status, campaign_name, submitted_at, created_at, converted_at, archived_at').is('archived_at', null)
    // Backward compatibility while the optional bulk/archive migration is pending.
    if (marketing.error?.message.includes('archived_at')) {
      marketing = await supabase.from('marketing_leads').select('id, source, status, campaign_name, submitted_at, created_at, converted_at') as typeof marketing
    }
    const quickJoin = await supabase.from('payments').select('id, created_at, metadata').eq('metadata->>flow_type', 'quick_join')
    if (marketing.error) throw marketing.error
    if (quickJoin.error) throw quickJoin.error
    const legacyStatus: Record<string, string> = { new: 'new', contacted: 'contacted', scheduled: 'trial_scheduled', done: 'converted' }
    const combined = [
      ...(marketing.data || []),
      ...(quickJoin.data || []).map((row) => ({ id: row.id, source: 'website', status: legacyStatus[String(row.metadata?.lead_status || 'new')] || 'new', campaign_name: String(row.metadata?.promo_label || 'Website quick join'), submitted_at: row.created_at, created_at: row.created_at, converted_at: null, archived_at: null })),
    ]
    const fromTime = from ? new Date(`${from}T00:00:00.000Z`).getTime() : null
    const toTime = to ? new Date(`${to}T23:59:59.999Z`).getTime() : null
    const rows = combined.filter((row) => {
      const time = new Date(row.submitted_at || row.created_at).getTime()
      return (!sourceFilter || sourceFilter === 'all' || channel(row.source) === sourceFilter) && (fromTime === null || time >= fromTime) && (toTime === null || time <= toTime)
    })
    const statusOrder = ['new', 'attempted_contact', 'contacted', 'follow_up', 'trial_scheduled', 'trial_attended', 'converted', 'not_interested', 'unreachable', 'cold']
    const statusCounts = statusOrder.map((status) => ({ status, count: rows.filter((row) => row.status === status).length }))
    const channels = ['Meta', 'TikTok', 'Website', 'Manual', 'Other'].map((name) => {
      const matches = rows.filter((row) => channel(row.source) === name)
      const converted = matches.filter((row) => row.status === 'converted').length
      return { name, leads: matches.length, converted, conversionRate: matches.length ? Number(((converted / matches.length) * 100).toFixed(1)) : 0 }
    }).filter((item) => item.leads > 0)
    const monthlyMap = new Map<string, { leads: number; converted: number }>()
    for (const row of rows) {
      const date = row.submitted_at || row.created_at
      const key = date.slice(0, 7)
      const item = monthlyMap.get(key) || { leads: 0, converted: 0 }
      item.leads++; if (row.status === 'converted') item.converted++
      monthlyMap.set(key, item)
    }
    const monthly = [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({ month, ...values }))
    const campaignMap = new Map<string, { leads: number; contacted: number; converted: number }>()
    for (const row of rows) {
      const name = row.campaign_name || 'Unknown campaign'
      const item = campaignMap.get(name) || { leads: 0, contacted: 0, converted: 0 }
      item.leads++
      if (!['new', 'attempted_contact', 'unreachable'].includes(row.status)) item.contacted++
      if (row.status === 'converted') item.converted++
      campaignMap.set(name, item)
    }
    const campaigns = [...campaignMap.entries()].map(([name, values]) => ({ name, ...values, conversionRate: values.leads ? Number(((values.converted / values.leads) * 100).toFixed(1)) : 0 })).sort((a, b) => b.leads - a.leads)
    const converted = rows.filter((row) => row.status === 'converted').length
    const progressed = rows.filter((row) => !['new', 'attempted_contact', 'unreachable'].includes(row.status)).length
    return NextResponse.json({ success: true, data: { summary: { total: rows.length, new: rows.filter((row) => row.status === 'new').length, progressed, converted, conversionRate: rows.length ? Number(((converted / rows.length) * 100).toFixed(1)) : 0 }, monthly, channels, statuses: statusCounts, campaigns } })
  } catch (error) {
    console.error('[API /leads/analytics]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to load lead analytics' } }, { status: 500 })
  }
}
