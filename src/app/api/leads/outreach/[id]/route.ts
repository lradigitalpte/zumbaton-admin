import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  }

  try {
    const { id } = await params
    const supabase = getSupabaseAdminClient()

    const { data: campaign, error } = await supabase
      .from('lead_outreach_campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ success: false, error: { message: 'Campaign not found' } }, { status: 404 })
    }

    const { data: messages } = await supabase
      .from('lead_outreach_messages')
      .select('id, lead_id, channel, recipient, lead_name, status, error_message, provider_message_id, sent_at, delivered_at, opened_at, clicked_at, created_at')
      .eq('campaign_id', id)
      .order('created_at', { ascending: true })
      .limit(500)

    return NextResponse.json({
      success: true,
      data: { campaign, messages: messages || [] },
    })
  } catch (error) {
    console.error('[API /leads/outreach/[id] GET]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to load campaign' } }, { status: 500 })
  }
}
