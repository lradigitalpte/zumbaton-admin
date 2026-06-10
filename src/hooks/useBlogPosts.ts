import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { BlogPostRow } from '@/lib/blog-utils'

type BlogListResponse = { success: boolean; data: BlogPostRow[] }
type BlogPostResponse = { success: boolean; data: BlogPostRow }

export function useBlogPosts(status?: 'draft' | 'published' | 'all') {
  const queryKey = ['blog-posts', status ?? 'all']

  return useQuery({
    queryKey,
    queryFn: async () => {
      const qs = status && status !== 'all' ? `?status=${status}` : ''
      const res = await api.get<BlogListResponse>(`/api/blog${qs}`)
      if (res.error) throw new Error(res.error.message)
      const payload = res.data as BlogListResponse | BlogPostRow[] | undefined
      if (Array.isArray(payload)) return payload
      return payload?.data ?? []
    },
  })
}

export function useBlogPost(id: string | null) {
  return useQuery({
    queryKey: ['blog-post', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<BlogPostResponse>(`/api/blog/${id}`)
      if (res.error) throw new Error(res.error.message)
      const payload = res.data as BlogPostResponse | BlogPostRow | undefined
      if (payload && 'slug' in payload) return payload as BlogPostRow
      return (payload as BlogPostResponse)?.data
    },
  })
}

export function useBlogMutations() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['blog-posts'] })
    queryClient.invalidateQueries({ queryKey: ['blog-post'] })
  }

  const createPost = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await api.post<BlogPostResponse>('/api/blog', body)
      if (res.error) throw new Error(res.error.message)
      const payload = res.data as BlogPostResponse | BlogPostRow | undefined
      if (payload && 'slug' in payload) return payload as BlogPostRow
      return (payload as BlogPostResponse)?.data
    },
    onSuccess: invalidate,
  })

  const updatePost = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await api.patch<BlogPostResponse>(`/api/blog/${id}`, body)
      if (res.error) throw new Error(res.error.message)
      const payload = res.data as BlogPostResponse | BlogPostRow | undefined
      if (payload && 'slug' in payload) return payload as BlogPostRow
      return (payload as BlogPostResponse)?.data
    },
    onSuccess: invalidate,
  })

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/blog/${id}`)
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: invalidate,
  })

  return { createPost, updatePost, deletePost }
}
