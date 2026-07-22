import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_WHATSAPP_BODY,
} from '@/lib/lead-outreach-templates'
import { getWhatsAppConfigStatus } from '@/lib/whatsapp'
import { getEmailOutreachStatus } from '@/lib/email-outreach-status'
import {
  createLeadOutreachCampaign,
  resolveMarketingIdsFromFilters,
} from '@/lib/lead-outreach-campaign'
import { resolveLeadIdsFromRequest } from '@/lib/lead-outreach-resolve'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data: campaigns, error } = await supabase
      .from('lead_outreach_campaigns')
      .select('id, name, channels, status, total_count, sent_count, failed_count, skipped_count, created_at, completed_at, created_by, template_id')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        campaigns: campaigns || [],
        email: getEmailOutreachStatus(),
        whatsapp: getWhatsAppConfigStatus(),
        defaults: {
          emailSubject: DEFAULT_EMAIL_SUBJECT,
          emailBody: DEFAULT_EMAIL_BODY,
          whatsappBody: DEFAULT_WHATSAPP_BODY,
        },
      },
    })
  } catch (error) {
    console.error('[API /leads/outreach GET]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to load campaigns' } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin', 'staff'].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  }

  try {
    const body = await request.json()
    const channels: string[] = Array.isArray(body.channels) ? body.channels : []
    const supabase = getSupabaseAdminClient()

    const marketingIds = await resolveLeadIdsFromRequest(supabase, body)
    if (!marketingIds.length) {
      return NextResponse.json({ success: false, error: { message: 'No marketing leads selected' } }, { status: 400 })
    }

    let emailSubject = body.emailSubject
    let emailBody = body.emailBody
    let whatsappBody = body.whatsappBody
    let templateId: string | null = body.templateId || null

    if (body.templateId) {
      const { data: template } = await supabase
        .from('lead_outreach_templates')
        .select('*')
        .eq('id', body.templateId)
        .single()

      if (template) {
        if (!emailSubject) emailSubject = template.email_subject
        if (!emailBody) emailBody = template.email_body
        if (!whatsappBody) whatsappBody = template.whatsapp_body
        templateId = template.id
      }
    }

    const result = await createLeadOutreachCampaign({
      userId: user.id,
      marketingIds,
      channels,
      emailSubject,
      emailBody,
      whatsappBody,
      name: body.name,
      templateId,
      filters: body.useFilters ? body.filters : { leadIds: marketingIds },
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('[API /leads/outreach POST]', error)
    const message = error instanceof Error ? error.message : 'Failed to queue follow-up'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
