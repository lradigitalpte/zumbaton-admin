import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { resolveOutreachRecipients } from '@/lib/lead-outreach-resolve'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  if (!['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
  }

  try {
    const body = await request.json()
    const supabase = getSupabaseAdminClient()

    let leadIds: string[] | undefined
    if (Array.isArray(body.items) && body.items.length) {
      leadIds = body.items.filter((i: { kind: string }) => i.kind === 'marketing').map((i: { id: string }) => i.id)
    } else if (body.useFilters && body.filters) {
      const filters = Object.fromEntries(
        Object.entries(body.filters as Record<string, string>).filter(([, value]) => Boolean(value))
      )
      const resolved = await resolveOutreachRecipients(supabase, { filters })
      return NextResponse.json({ success: true, data: resolved })
    }

    if (!leadIds?.length) {
      return NextResponse.json({ success: false, error: { message: 'Select at least one lead' } }, { status: 400 })
    }

    const result = await resolveOutreachRecipients(supabase, { leadIds })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[API /leads/outreach/resolve]', error)
    const message = error instanceof Error ? error.message : 'Failed to resolve recipients'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
