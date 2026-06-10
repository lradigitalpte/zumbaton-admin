import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'
import {
  BLOG_POST_SELECT,
  BlogPostRow,
  normalizeBlogInput,
  slugifyTitle,
  parseTagsInput,
  toBlogUpdatePayload,
} from '@/lib/blog-utils'

export const dynamic = 'force-dynamic'

const ADMIN_ROLES = ['super_admin', 'admin'] as const

function canManageBlog(role: string | undefined) {
  return role && (ADMIN_ROLES as readonly string[]).includes(role)
}

// GET /api/blog/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !canManageBlog(user.role)) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
    }

    const { id } = await params
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase.from('blog_posts').select(BLOG_POST_SELECT).eq('id', id).single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[API blog GET id]', e)
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } }, { status: 500 })
  }
}

// PATCH /api/blog/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !canManageBlog(user.role)) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const supabase = getSupabaseAdminClient()

    const { data: existing, error: fetchError } = await supabase
      .from('blog_posts')
      .select('id, status, published_at')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, { status: 404 })
    }

    const partial: Record<string, unknown> = {}
    if (typeof body.title === 'string') partial.title = body.title.trim()
    if (typeof body.slug === 'string') partial.slug = slugifyTitle(body.slug.trim())
    if (typeof body.excerpt === 'string') partial.excerpt = body.excerpt.trim()
    if (typeof body.body === 'string') partial.body = body.body
    if (body.featured_image_url !== undefined) {
      partial.featured_image_url =
        typeof body.featured_image_url === 'string' ? body.featured_image_url.trim() || null : null
    }
    if (typeof body.author_name === 'string') partial.author_name = body.author_name.trim()
    if (body.author_image_url !== undefined) {
      partial.author_image_url =
        typeof body.author_image_url === 'string' ? body.author_image_url.trim() || null : null
    }
    if (typeof body.author_designation === 'string') {
      partial.author_designation = body.author_designation.trim() || null
    }
    if (body.tags !== undefined) partial.tags = parseTagsInput(body.tags)
    if (body.status === 'draft' || body.status === 'published') partial.status = body.status
    if (typeof body.seo_title === 'string') partial.seo_title = body.seo_title.trim() || null
    if (typeof body.seo_description === 'string') {
      partial.seo_description = body.seo_description.trim() || null
    }
    if (body.og_image_url !== undefined) {
      partial.og_image_url = typeof body.og_image_url === 'string' ? body.og_image_url.trim() || null : null
    }
    if (typeof body.is_featured === 'boolean') partial.is_featured = body.is_featured

    const updates = toBlogUpdatePayload(partial, existing as Pick<BlogPostRow, 'status' | 'published_at'>)

    const { data, error } = await supabase
      .from('blog_posts')
      .update(updates)
      .eq('id', id)
      .select(BLOG_POST_SELECT)
      .single()

    if (error) {
      const message =
        error.code === '23505' ? 'A post with this URL slug already exists' : error.message
      console.error('[API blog PATCH]', error)
      return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message } }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[API blog PATCH]', e)
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } }, { status: 500 })
  }
}

// DELETE /api/blog/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !canManageBlog(user.role)) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
    }

    const { id } = await params
    const supabase = getSupabaseAdminClient()
    const { error } = await supabase.from('blog_posts').delete().eq('id', id)

    if (error) {
      console.error('[API blog DELETE]', error)
      return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[API blog DELETE]', e)
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } }, { status: 500 })
  }
}
