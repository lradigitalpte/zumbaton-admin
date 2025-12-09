/**
 * Generic React Query hooks for any entity type
 * Use this pattern to quickly add caching to any page
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// Generic query key factory - use for any entity type
export function createEntityKeys(entityName: string) {
  return {
    all: [entityName] as const,
    lists: () => [...createEntityKeys(entityName).all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...createEntityKeys(entityName).lists(), filters || {}] as const,
    details: () => [...createEntityKeys(entityName).all, 'detail'] as const,
    detail: (id: string) => [...createEntityKeys(entityName).details(), id] as const,
  }
}

/**
 * Generic hook to fetch a list of entities
 * 
 * Usage:
 *   const { data = [], isLoading, error, refetch } = useEntityList({
 *     endpoint: '/api/users',
 *     queryKey: 'users',
 *     filters: { role: 'admin', isActive: true }
 *   })
 */
export function useEntityList<T = unknown>(options: {
  endpoint: string
  queryKey: string
  filters?: Record<string, unknown>
  enabled?: boolean
  staleTime?: number
}) {
  const keys = createEntityKeys(options.queryKey)
  
  return useQuery({
    queryKey: keys.list(options.filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value))
          }
        })
      }
      
      const url = params.toString() 
        ? `${options.endpoint}?${params.toString()}`
        : options.endpoint
        
      const response = await api.get<{ data: T[] }>(url)
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch data')
      }
      
      return response.data?.data || []
    },
    enabled: options.enabled !== false,
    staleTime: 0, // Always stale so refetch works
    gcTime: 10 * 60 * 1000, // 10 minutes default
  })
}

/**
 * Generic hook to fetch a single entity
 * 
 * Usage:
 *   const { data, isLoading, error, refetch } = useEntityDetail({
 *     endpoint: '/api/users',
 *     queryKey: 'users',
 *     id: '123'
 *   })
 */
export function useEntityDetail<T = unknown>(options: {
  endpoint: string
  queryKey: string
  id: string
  enabled?: boolean
  staleTime?: number
}) {
  const keys = createEntityKeys(options.queryKey)
  
  return useQuery({
    queryKey: keys.detail(options.id),
    queryFn: async () => {
      const response = await api.get<{ data: T }>(`${options.endpoint}/${options.id}`)
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch data')
      }
      
      return response.data?.data
    },
    enabled: options.enabled !== false && !!options.id,
    staleTime: 0, // Always stale so refetch works
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * Generic hook for cache invalidation
 * 
 * Usage:
 *   const { invalidateAll, invalidateList, invalidateDetail } = useInvalidateEntity('users')
 *   
 *   // After creating/updating/deleting:
 *   invalidateAll()
 */
export function useInvalidateEntity(queryKey: string) {
  const queryClient = useQueryClient()
  const keys = createEntityKeys(queryKey)
  
  return {
    invalidateAll: () => queryClient.invalidateQueries({ 
      queryKey: keys.all,
      refetchType: 'active',
    }),
    invalidateList: (filters?: Record<string, unknown>) => {
      if (filters) {
        queryClient.invalidateQueries({ 
          queryKey: keys.list(filters),
          refetchType: 'active',
        })
      } else {
        queryClient.invalidateQueries({ 
          queryKey: keys.lists(),
          refetchType: 'active',
        })
      }
    },
    invalidateDetail: (id: string) => {
      queryClient.invalidateQueries({ 
        queryKey: keys.detail(id),
        refetchType: 'active',
      })
    },
  }
}

/**
 * Generic mutation hook
 * 
 * Usage:
 *   const mutation = useEntityMutation({
 *     queryKey: 'users',
 *     mutationFn: async (data) => {
 *       return await api.post('/api/users', data)
 *     },
 *     onSuccess: () => {
 *       invalidateAll()
 *     }
 *   })
 */
export function useEntityMutation<TData = unknown, TVariables = unknown>(
  options: {
    queryKey?: string
    mutationFn: (variables: TVariables) => Promise<TData>
    onSuccess?: (data: TData, variables: TVariables) => void
    onError?: (error: Error, variables: TVariables) => void
    invalidateQueries?: boolean | string[]
  }
) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (data, variables) => {
      // Auto-invalidate cache with immediate refetch
      if (options.invalidateQueries && options.queryKey) {
        if (options.invalidateQueries === true) {
          queryClient.invalidateQueries({ 
            queryKey: [options.queryKey],
            refetchType: 'active',
          })
        } else if (Array.isArray(options.invalidateQueries)) {
          options.invalidateQueries.forEach(key => {
            queryClient.invalidateQueries({ 
              queryKey: [key],
              refetchType: 'active',
            })
          })
        }
      }
      
      options.onSuccess?.(data, variables)
    },
    onError: options.onError,
  })
}

