import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

export async function PUT(
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
    const body = await request.json()
    const supabase = getSupabaseAdminClient()

    if (body.isDefault) {
      await supabase.from('lead_outreach_templates').update({ is_default: false }).eq('is_default', true)
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.name === 'string') updates.name = body.name.trim()
    if (['email', 'whatsapp', 'both'].includes(body.channel)) updates.channel = body.channel
    if (typeof body.emailSubject === 'string') updates.email_subject = body.emailSubject.slice(0, 200)
    if (typeof body.emailBody === 'string') updates.email_body = body.emailBody.slice(0, 10000)
    if (typeof body.whatsappBody === 'string') updates.whatsapp_body = body.whatsappBody.slice(0, 1000)
    if (typeof body.isDefault === 'boolean') updates.is_default = body.isDefault

    const { data, error } = await supabase
      .from('lead_outreach_templates')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: { message: 'Template not found' } }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: mapTemplate(data) })
  } catch (error) {
    console.error('[API /leads/templates/[id] PUT]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to update template' } }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin'].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  }

  try {
    const { id } = await params
    const supabase = getSupabaseAdminClient()

    const { data: existing } = await supabase
      .from('lead_outreach_templates')
      .select('is_default')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: 'Template not found' } }, { status: 404 })
    }
    if (existing.is_default) {
      return NextResponse.json({ success: false, error: { message: 'Cannot delete the default template' } }, { status: 400 })
    }

    const { error } = await supabase.from('lead_outreach_templates').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API /leads/templates/[id] DELETE]', error)
    return NextResponse.json({ success: false, error: { message: 'Failed to delete template' } }, { status: 500 })
  }
}
