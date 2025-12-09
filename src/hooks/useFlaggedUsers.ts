import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useUsers, type User } from './useUsers'

export interface FlaggedUser extends User {
  flagReason?: string
  flaggedAt?: string
  flaggedBy?: string
}

// Query key factory
const flaggedUsersKeys = {
  all: ['flaggedUsers'] as const,
  list: (filters?: Record<string, unknown>) => [...flaggedUsersKeys.all, 'list', filters] as const,
}

// Fetch flagged users - reuse useUsers hook with isFlagged filter
export function useFlaggedUsers(filters?: { search?: string; page?: number; pageSize?: number }) {
  return useUsers({
    isFlagged: true,
    role: 'user', // Only regular users
    search: filters?.search,
    page: filters?.page || 1,
    pageSize: filters?.pageSize || 100, // Get all flagged users
  }, {
    enabled: true, // Always enabled
  })
}

// Hook to flag a user
export function useFlagUser() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await api.put<{ data: any }>(`/api/users/${userId}`, {
        isFlagged: true,
      })
      
      if (response.error) {
        throw new Error(response.error.message || "Failed to flag user")
      }
      
      return response.data
    },
    onSuccess: () => {
      // Invalidate all user-related queries with immediate refetch
      queryClient.invalidateQueries({ queryKey: ['users'], refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['flaggedUsers'], refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['user'], refetchType: 'active' })
    },
  })
}

// Hook to unflag a user
export function useUnflagUser() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const response = await api.put<{ data: any }>(`/api/users/${userId}`, {
        isFlagged: false,
      })
      
      if (response.error) {
        throw new Error(response.error.message || "Failed to unflag user")
      }
      
      return response.data
    },
    onSuccess: () => {
      // Invalidate all user-related queries with immediate refetch
      queryClient.invalidateQueries({ queryKey: ['users'], refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['flaggedUsers'], refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['user'], refetchType: 'active' })
    },
  })
}

// Hook to invalidate flagged users cache
export function useInvalidateFlaggedUsers() {
  const queryClient = useQueryClient()
  
  return {
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: flaggedUsersKeys.all, refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['users'], refetchType: 'active' })
    },
  }
}

