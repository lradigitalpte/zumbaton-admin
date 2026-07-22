import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function requireStaff(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return { error: NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 }) }
  if (!['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
    return { error: NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 }) }
  }
  return { user }
}

function mapTemplate(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    emailSubject: row.email_subject || '',
    emailBody: row.email_body || '',
    whatsappBody: row.whatsapp_body || '',
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET(request: NextRequest) {
  const gate = await requireStaff(request)
  if (gate.error) return gate.error

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('lead_outreach_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: { templates: (data || []).map(mapTemplate) },
    })
  } catch (error) {
    console.error('[API /leads/templates GET]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to load templates' } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireStaff(request)
  if (gate.error) return gate.error
  if (!['super_admin', 'admin', 'staff'].includes(gate.user!.role)) {
    return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  }

  try {
    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ success: false, error: { message: 'Template name is required' } }, { status: 400 })

    const channel = ['email', 'whatsapp', 'both'].includes(body.channel) ? body.channel : 'email'
    const supabase = getSupabaseAdminClient()

    if (body.isDefault) {
      await supabase.from('lead_outreach_templates').update({ is_default: false }).eq('is_default', true)
    }

    const { data, error } = await supabase
      .from('lead_outreach_templates')
      .insert({
        name,
        channel,
        email_subject: String(body.emailSubject || '').slice(0, 200) || null,
        email_body: String(body.emailBody || '').slice(0, 10000) || null,
        whatsapp_body: String(body.whatsappBody || '').slice(0, 1000) || null,
        is_default: Boolean(body.isDefault),
        created_by: gate.user!.id,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: mapTemplate(data) }, { status: 201 })
  } catch (error) {
    console.error('[API /leads/templates POST]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to create template' } }, { status: 500 })
  }
}
