import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { exportCounts, filterLeads, type LeadExportRow } from '@/lib/lead-export'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 25)))

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('marketing_leads')
      .select('id, name, phone, email, normalized_phone, normalized_email, source, status, campaign_name, submitted_at, created_at, archived_at')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) throw error

    const filtered = filterLeads((data || []) as LeadExportRow[], searchParams)
    const counts = exportCounts(filtered)
    const start = (page - 1) * pageSize
    const pageRows = filtered.slice(start, start + pageSize).map((lead) => ({
      id: lead.id,
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source,
      status: lead.status,
      campaign: lead.campaign_name || '',
      submittedAt: lead.submitted_at || lead.created_at,
      canEmail: Boolean(lead.email),
      canWhatsApp: Boolean(lead.phone),
    }))

    return NextResponse.json({
      success: true,
      data: {
        leads: pageRows,
        counts,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
        totalMatching: filtered.length,
      },
    })
  } catch (error) {
    console.error('[API /leads/export/preview]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to load preview' } }, { status: 500 })
  }
}
