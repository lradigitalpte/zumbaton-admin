import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface User {
  id: string
  name: string
  email: string
  phone?: string | null
  avatar?: string
  avatarUrl?: string | null
  role: string
  isActive: boolean
  isFlagged: boolean
  createdAt: string
  updatedAt?: string
  // Stats
  tokenBalance: number
  totalClasses: number
  noShows: number
  joinedDate: string
  lastActive: string
  // Computed status
  status: "active" | "flagged" | "inactive"
}

interface UseUsersQueryParams {
  page?: number
  pageSize?: number
  role?: string
  isActive?: boolean
  isFlagged?: boolean
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Query key factory
const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UseUsersQueryParams) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
}

// Helper to compute status from isActive and isFlagged
function computeStatus(isActive: boolean, isFlagged: boolean): "active" | "flagged" | "inactive" {
  if (isFlagged) return "flagged"
  if (!isActive) return "inactive"
  return "active"
}

// Fetch users from API - enhanced with stats
async function fetchUsers(filters: UseUsersQueryParams = {}): Promise<{
  users: User[]
  total: number
  page: number
  pageSize: number
}> {
  const params = new URLSearchParams()
  
  if (filters.page) params.append('page', String(filters.page))
  if (filters.pageSize) params.append('pageSize', String(filters.pageSize))
  if (filters.role && filters.role !== 'all') params.append('role', filters.role)
  if (filters.isActive !== undefined) params.append('isActive', String(filters.isActive))
  if (filters.isFlagged !== undefined) params.append('isFlagged', String(filters.isFlagged))
  if (filters.search) params.append('search', filters.search)
  if (filters.sortBy) params.append('sortBy', filters.sortBy)
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)

  const url = `/api/users?${params.toString()}`
  
  const response = await api.get<{ 
    data: any[] 
    pagination: {
      total: number
      page: number
      pageSize: number
    }
  }>(url)

  if (response.error) {
    throw new Error(response.error.message || "Failed to fetch users")
  }

  if (!response.data) {
    throw new Error("No data received from API")
  }

  // The API returns { data: [...users], pagination: {...} }
  const usersArray = response.data.data || []

  // Map API response to User interface with enhanced stats
  const users: User[] = usersArray.map((user: any) => {
    // Ensure isFlagged is properly read (handle both camelCase and snake_case, and boolean/null/undefined)
    const isFlagged = user.isFlagged === true || user.is_flagged === true || user.isFlagged === 'true' || user.is_flagged === 'true'
    const isActive = user.isActive === true || user.is_active === true || user.isActive === 'true' || user.is_active === 'true'
    
    const status = computeStatus(isActive, isFlagged)
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive,
      isFlagged,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      // Enhanced data from API
      tokenBalance: user.currentTokenBalance || 0,
      totalClasses: user.totalClassesBooked || user.stats?.totalClassesBooked || 0,
      noShows: user.totalNoShows || user.stats?.totalNoShows || 0,
      joinedDate: user.createdAt, // Map createdAt to joinedDate for UI
      lastActive: user.updatedAt || user.createdAt,
      avatar: user.avatarUrl || undefined, // Map avatarUrl to avatar for compatibility
      status, // Computed status
    }
  })

  return {
    users,
    total: response.data?.pagination?.total || 0,
    page: response.data?.pagination?.page || filters.page || 1,
    pageSize: response.data?.pagination?.pageSize || filters.pageSize || 10,
  }
}

// Hook to fetch users with caching
export function useUsers(filters: UseUsersQueryParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => fetchUsers(filters),
    enabled: options?.enabled !== false, // Only run if enabled (default: true)
    // Uses global 30-minute staleTime from react-query.tsx
    // Manual refresh available via Refresh button
  })
}

// Hook to invalidate users cache
export function useInvalidateUsers() {
  const queryClient = useQueryClient()
  
  return {
    invalidateAll: () => queryClient.invalidateQueries({ 
      queryKey: userKeys.all,
      refetchType: 'active', // Force immediate refetch
    }),
    invalidateList: (filters?: UseUsersQueryParams) => {
      if (filters) {
        queryClient.invalidateQueries({ 
          queryKey: userKeys.list(filters),
          refetchType: 'active',
        })
      } else {
        queryClient.invalidateQueries({ 
          queryKey: userKeys.lists(),
          refetchType: 'active',
        })
      }
    },
  }
}
