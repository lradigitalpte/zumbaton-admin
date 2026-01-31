// Announcements – update (message, is_active, sort_order) and delete

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export const dynamic = 'force-dynamic'

// PATCH /api/announcements/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await request.json()
    const updates: { message?: string; is_active?: boolean; sort_order?: number; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }
    if (typeof body.message === 'string') updates.message = body.message.trim()
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
    if (typeof body.sort_order === 'number') updates.sort_order = body.sort_order

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('announcements')
      .update(updates)
      .eq('id', id)
      .select('id, message, is_active, sort_order, created_at, updated_at')
      .single()

    if (error) {
      console.error('[API announcements PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[API announcements PATCH]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/announcements/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(_request)
    if (!user || !['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = getSupabaseAdminClient()
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) {
      console.error('[API announcements DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API announcements DELETE]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
