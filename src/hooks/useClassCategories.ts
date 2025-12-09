import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface ClassCategory {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  icon: string | null
  parentId: string | null
  isActive: boolean
  sortOrder: number
}

export interface CreateCategoryData {
  name: string
  slug?: string
  description?: string
  color?: string
  icon?: string
  parentId?: string
}

async function fetchCategories(): Promise<ClassCategory[]> {
  const response = await api.get<{ success: boolean; data: { categories: ClassCategory[] } }>('/api/class-categories')

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch categories')
  }

  if (!response.data?.success) {
    throw new Error('Failed to fetch categories')
  }

  return response.data.data.categories || []
}

async function createCategory(data: CreateCategoryData): Promise<ClassCategory> {
  // Auto-generate slug from name if not provided
  const slug = data.slug || data.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()

  const response = await api.post<{ success: boolean; data: { category: ClassCategory } }>('/api/class-categories', {
    name: data.name,
    slug,
    description: data.description || null,
    color: data.color || '#f59e0b',
    icon: data.icon || null,
    parentId: data.parentId || null,
  })

  if (response.error) {
    throw new Error(response.error.message || 'Failed to create category')
  }

  if (!response.data?.success) {
    const errorMessage = (response.data as any)?.error?.message || 'Failed to create category'
    throw new Error(errorMessage)
  }

  return response.data.data.category
}

export function useClassCategories() {
  return useQuery({
    queryKey: ['class-categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      // Invalidate and refetch categories
      queryClient.invalidateQueries({ queryKey: ['class-categories'] })
    },
  })
}

export interface UpdateCategoryData {
  name?: string
  slug?: string
  description?: string
  color?: string
  icon?: string
  parentId?: string
  isActive?: boolean
  sortOrder?: number
}

async function updateCategory(id: string, data: UpdateCategoryData): Promise<ClassCategory> {
  const response = await api.patch<{ success: boolean; data: { category: ClassCategory } }>(
    `/api/class-categories/${id}`,
    data
  )

  if (response.error) {
    throw new Error(response.error.message || 'Failed to update category')
  }

  if (!response.data?.success) {
    const errorMessage = (response.data as any)?.error?.message || 'Failed to update category'
    throw new Error(errorMessage)
  }

  return response.data.data.category
}

async function deleteCategory(id: string): Promise<void> {
  const response = await api.delete<{ success: boolean; message?: string }>(
    `/api/class-categories/${id}`
  )

  if (response.error) {
    throw new Error(response.error.message || 'Failed to delete category')
  }

  if (!response.data?.success) {
    const errorMessage = (response.data as any)?.error?.message || 'Failed to delete category'
    throw new Error(errorMessage)
  }
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryData }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-categories'] })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-categories'] })
    },
  })
}

