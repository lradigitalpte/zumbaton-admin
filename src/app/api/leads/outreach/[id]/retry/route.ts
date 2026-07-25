import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import {
  getOutreachQueueConfig,
  processCampaignQueueNow,
  retryFailedCampaignMessages,
} from '@/services/lead-outreach.service'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin', 'staff'].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as { action?: string }
    const action = body.action === 'pending' ? 'pending' : 'failed'

    const supabase = getSupabaseAdminClient()
    const { data: campaign, error } = await supabase
      .from('lead_outreach_campaigns')
      .select('id')
      .eq('id', id)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ success: false, error: { message: 'Campaign not found' } }, { status: 404 })
    }

    const result =
      action === 'pending'
        ? await processCampaignQueueNow(id)
        : await retryFailedCampaignMessages(id)

    return NextResponse.json({
      success: true,
      data: {
        action,
        ...result,
        config: getOutreachQueueConfig(),
      },
    })
  } catch (error) {
    console.error('[API /leads/outreach/[id]/retry POST]', error)
    return NextResponse.json({ success: false, error: { message: 'Retry failed' } }, { status: 500 })
  }
}
