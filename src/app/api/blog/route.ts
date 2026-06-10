import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'
import {
  BLOG_POST_SELECT,
  normalizeBlogInput,
  toBlogDbPayload,
} from '@/lib/blog-utils'

export const dynamic = 'force-dynamic'

const ADMIN_ROLES = ['super_admin', 'admin'] as const

function canManageBlog(role: string | undefined) {
  return role && (ADMIN_ROLES as readonly string[]).includes(role)
}

// GET /api/blog — list all posts (admin)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !canManageBlog(user.role)) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const supabase = getSupabaseAdminClient()
    let query = supabase
      .from('blog_posts')
      .select(BLOG_POST_SELECT)
      .order('updated_at', { ascending: false })

    if (status === 'draft' || status === 'published') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('[API blog GET]', error)
      return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (e) {
    console.error('[API blog GET]', e)
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } }, { status: 500 })
  }
}

// POST /api/blog — create post
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !canManageBlog(user.role)) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
    }

    const body = await request.json()
    const input = normalizeBlogInput(body)
    if (!input) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Title is required' } },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    const payload = toBlogDbPayload(input, user.id)

    const { data, error } = await supabase
      .from('blog_posts')
      .insert(payload)
      .select(BLOG_POST_SELECT)
      .single()

    if (error) {
      const message =
        error.code === '23505' ? 'A post with this URL slug already exists' : error.message
      console.error('[API blog POST]', error)
      return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message } }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[API blog POST]', e)
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } }, { status: 500 })
  }
}
