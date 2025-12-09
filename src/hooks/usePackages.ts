import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// =====================================================
// Types
// =====================================================

export type ClassType = 'zumba' | 'yoga' | 'pilates' | 'hiit' | 'spinning' | 'boxing' | 'dance' | 'strength' | 'cardio' | 'all'

export interface Package {
  id: string
  name: string
  description: string | null
  tokenCount: number
  priceCents: number
  currency: string
  validityDays: number
  classTypes: ClassType[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PackageWithStats extends Package {
  salesCount: number
  revenue: number
}

export interface PackageListQuery {
  page?: number
  pageSize?: number
  isActive?: boolean
  classType?: ClassType
}

export interface CreatePackageData {
  name: string
  description?: string
  tokenCount: number
  priceCents: number
  currency?: string
  validityDays: number
  classTypes?: ClassType[]
  isActive?: boolean
}

export interface UpdatePackageData {
  name?: string
  description?: string | null
  tokenCount?: number
  priceCents?: number
  currency?: string
  validityDays?: number
  classTypes?: ClassType[]
  isActive?: boolean
}

// =====================================================
// Query Keys
// =====================================================

export const packageKeys = {
  all: ['packages'] as const,
  lists: () => [...packageKeys.all, 'list'] as const,
  list: (filters: PackageListQuery) => [...packageKeys.lists(), filters] as const,
  details: () => [...packageKeys.all, 'detail'] as const,
  detail: (id: string) => [...packageKeys.details(), id] as const,
}

// =====================================================
// Fetch Functions
// =====================================================

async function fetchPackages(query: PackageListQuery): Promise<{
  packages: PackageWithStats[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}> {
  const params = new URLSearchParams()
  
  if (query.page) params.append('page', query.page.toString())
  if (query.pageSize) params.append('pageSize', query.pageSize.toString())
  if (query.isActive !== undefined) params.append('isActive', query.isActive.toString())
  if (query.classType) params.append('classType', query.classType)

  const response = await api.get<{ 
    data: { 
      packages: PackageWithStats[]
      total: number
      page: number
      pageSize: number
      hasMore: boolean 
    } 
  }>(`/api/packages?${params.toString()}`)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch packages')
  }

  return response.data?.data || { packages: [], total: 0, page: 1, pageSize: 20, hasMore: false }
}

async function createPackage(data: CreatePackageData): Promise<Package> {
  const response = await api.post<{ data: { package: Package } }>('/api/packages', data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to create package')
  }

  return response.data?.data?.package as Package
}

async function updatePackage(id: string, data: UpdatePackageData): Promise<Package> {
  const response = await api.patch<{ data: { package: Package } }>(`/api/packages?id=${id}`, data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to update package')
  }

  return response.data?.data?.package as Package
}

async function deactivatePackage(id: string): Promise<{ success: boolean; message: string }> {
  const response = await api.delete<{ data: { success: boolean; message: string } }>(`/api/packages?id=${id}`)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to deactivate package')
  }

  return response.data?.data || { success: false, message: 'Unknown error' }
}

async function togglePackageStatus(id: string, isActive: boolean): Promise<Package> {
  const response = await api.patch<{ data: { package: Package } }>(`/api/packages?id=${id}`, { isActive })

  if (response.error) {
    throw new Error(response.error.message || 'Failed to update package status')
  }

  return response.data?.data?.package as Package
}

// =====================================================
// Hooks
// =====================================================

// Fetch list of packages
export function usePackages(query: PackageListQuery = {}) {
  return useQuery({
    queryKey: packageKeys.list(query),
    queryFn: () => fetchPackages(query),
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  })
}

// Create package mutation
export function useCreatePackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPackage,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: packageKeys.all,
        refetchType: 'active',
      })
    },
  })
}

// Update package mutation
export function useUpdatePackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePackageData }) => updatePackage(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: packageKeys.detail(variables.id),
        refetchType: 'active',
      })
      queryClient.invalidateQueries({
        queryKey: packageKeys.lists(),
        refetchType: 'active',
      })
    },
  })
}

// Deactivate package mutation
export function useDeactivatePackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deactivatePackage,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: packageKeys.all,
        refetchType: 'active',
      })
    },
  })
}

// Toggle package status mutation
export function useTogglePackageStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => togglePackageStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: packageKeys.all,
        refetchType: 'active',
      })
    },
  })
}

// Invalidate packages cache
export function useInvalidatePackages() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => queryClient.invalidateQueries({
      queryKey: packageKeys.all,
      refetchType: 'active',
    }),
    invalidateList: (filters?: PackageListQuery) => {
      if (filters) {
        queryClient.invalidateQueries({
          queryKey: packageKeys.list(filters),
          refetchType: 'active',
        })
      } else {
        queryClient.invalidateQueries({
          queryKey: packageKeys.lists(),
          refetchType: 'active',
        })
      }
    },
  }
}
