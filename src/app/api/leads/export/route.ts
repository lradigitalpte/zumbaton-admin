import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import {
  buildCsv,
  dedupeBy,
  filterLeads,
  type LeadExportRow,
} from '@/lib/lead-export'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'full'
    if (!['phones', 'emails', 'full'].includes(format)) {
      return NextResponse.json({ success: false, error: { message: 'Invalid format' } }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('marketing_leads')
      .select('id, name, phone, email, normalized_phone, normalized_email, source, status, campaign_name, submitted_at, created_at, archived_at')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) throw error

    let leads = filterLeads((data || []) as LeadExportRow[], searchParams)

    if (format === 'phones') {
      leads = dedupeBy(leads.filter((l) => l.phone), (l) => l.normalized_phone)
      const csv = buildCsv(
        ['name', 'phone'],
        leads.map((l) => [l.name || '', l.phone || ''])
      )
      await supabase.from('lead_activities').insert(
        leads.slice(0, 100).map((l) => ({
          lead_id: l.id,
          actor_id: user.id,
          activity_type: 'exported',
          note: 'Phone list export',
          new_values: { format: 'phones', count: leads.length },
        }))
      )
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="leads-phones-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    if (format === 'emails') {
      leads = dedupeBy(leads.filter((l) => l.email), (l) => l.normalized_email)
      const csv = buildCsv(
        ['name', 'email'],
        leads.map((l) => [l.name || '', l.email || ''])
      )
      await supabase.from('lead_activities').insert(
        leads.slice(0, 100).map((l) => ({
          lead_id: l.id,
          actor_id: user.id,
          activity_type: 'exported',
          note: 'Email list export',
          new_values: { format: 'emails', count: leads.length },
        }))
      )
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="leads-emails-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    const csv = buildCsv(
      ['name', 'phone', 'email', 'source', 'status', 'campaign', 'submitted_at'],
      leads.map((l) => [
        l.name || '',
        l.phone || '',
        l.email || '',
        l.source || '',
        l.status || '',
        l.campaign_name || '',
        l.submitted_at || l.created_at || '',
      ])
    )

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-full-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error('[API /leads/export]', error)
    return NextResponse.json({ success: false, error: { message: 'Export failed' } }, { status: 500 })
  }
}
