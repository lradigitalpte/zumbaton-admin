// Announcements (header ticker) – list and create

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export const dynamic = 'force-dynamic'

// GET /api/announcements – list all (for admin)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('announcements')
      .select('id, message, is_active, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[API announcements]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('[API announcements GET]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/announcements – create
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !['super_admin', 'admin', 'staff', 'receptionist'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data: profile } = await supabase.from('user_profiles').select('id').eq('id', user.id).single()
    const createdBy = profile?.id ?? null

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        message,
        is_active: body.is_active !== false,
        sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
        created_by: createdBy,
        updated_at: new Date().toISOString(),
      })
      .select('id, message, is_active, sort_order, created_at, updated_at')
      .single()

    if (error) {
      console.error('[API announcements POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[API announcements POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
