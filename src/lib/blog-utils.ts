export type BlogPostStatus = 'draft' | 'published'

export type BlogPostRow = {
  id: string
  slug: string
  title: string
  excerpt: string
  body: string
  featured_image_url: string | null
  author_name: string
  author_image_url: string | null
  author_designation: string | null
  tags: string[]
  status: BlogPostStatus
  published_at: string | null
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  is_featured: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type BlogPostInput = {
  title: string
  slug: string
  excerpt: string
  body: string
  featured_image_url?: string | null
  author_name: string
  author_image_url?: string | null
  author_designation?: string | null
  tags: string[]
  status: BlogPostStatus
  seo_title?: string | null
  seo_description?: string | null
  og_image_url?: string | null
  is_featured?: boolean
}

const BLOG_POST_COLUMNS =
  'id, slug, title, excerpt, body, featured_image_url, author_name, author_image_url, author_designation, tags, status, published_at, seo_title, seo_description, og_image_url, is_featured, created_by, created_at, updated_at'

export const BLOG_POST_SELECT = BLOG_POST_COLUMNS

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export function parseTagsInput(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map(t => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 12)
  }
  if (typeof raw === 'string') {
    return [...new Set(raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12)
  }
  return []
}

export function normalizeBlogInput(body: Record<string, unknown>): BlogPostInput | null {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return null

  const slugRaw = typeof body.slug === 'string' ? body.slug.trim() : ''
  const slug = slugRaw ? slugifyTitle(slugRaw) : slugifyTitle(title)
  if (!slug) return null

  const status: BlogPostStatus = body.status === 'published' ? 'published' : 'draft'

  return {
    title,
    slug,
    excerpt: typeof body.excerpt === 'string' ? body.excerpt.trim() : '',
    body: typeof body.body === 'string' ? body.body : '',
    featured_image_url:
      typeof body.featured_image_url === 'string' ? body.featured_image_url.trim() || null : null,
    author_name:
      typeof body.author_name === 'string' && body.author_name.trim()
        ? body.author_name.trim()
        : 'One Step Fitness',
    author_image_url:
      typeof body.author_image_url === 'string' ? body.author_image_url.trim() || null : null,
    author_designation:
      typeof body.author_designation === 'string' ? body.author_designation.trim() || null : null,
    tags: parseTagsInput(body.tags),
    status,
    seo_title: typeof body.seo_title === 'string' ? body.seo_title.trim() || null : null,
    seo_description:
      typeof body.seo_description === 'string' ? body.seo_description.trim() || null : null,
    og_image_url: typeof body.og_image_url === 'string' ? body.og_image_url.trim() || null : null,
    is_featured: body.is_featured === true,
  }
}

export function toBlogDbPayload(input: BlogPostInput, createdBy?: string | null) {
  const now = new Date().toISOString()
  const wasPublished = input.status === 'published'

  return {
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    featured_image_url: input.featured_image_url,
    author_name: input.author_name,
    author_image_url: input.author_image_url,
    author_designation: input.author_designation,
    tags: input.tags,
    status: input.status,
    published_at: wasPublished ? now : null,
    seo_title: input.seo_title,
    seo_description: input.seo_description,
    og_image_url: input.og_image_url,
    is_featured: input.is_featured ?? false,
    created_by: createdBy ?? null,
    updated_at: now,
  }
}

export function toBlogUpdatePayload(
  input: Partial<BlogPostInput>,
  existing?: Pick<BlogPostRow, 'status' | 'published_at'>
) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.title !== undefined) updates.title = input.title
  if (input.slug !== undefined) updates.slug = input.slug
  if (input.excerpt !== undefined) updates.excerpt = input.excerpt
  if (input.body !== undefined) updates.body = input.body
  if (input.featured_image_url !== undefined) updates.featured_image_url = input.featured_image_url
  if (input.author_name !== undefined) updates.author_name = input.author_name
  if (input.author_image_url !== undefined) updates.author_image_url = input.author_image_url
  if (input.author_designation !== undefined) updates.author_designation = input.author_designation
  if (input.tags !== undefined) updates.tags = input.tags
  if (input.seo_title !== undefined) updates.seo_title = input.seo_title
  if (input.seo_description !== undefined) updates.seo_description = input.seo_description
  if (input.og_image_url !== undefined) updates.og_image_url = input.og_image_url
  if (input.is_featured !== undefined) updates.is_featured = input.is_featured

  if (input.status !== undefined) {
    updates.status = input.status
    if (input.status === 'published' && existing?.status !== 'published') {
      updates.published_at = new Date().toISOString()
    }
    if (input.status === 'draft') {
      updates.published_at = null
    }
  }

  return updates
}
