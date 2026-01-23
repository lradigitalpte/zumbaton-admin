import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export type StaffRole = "super_admin" | "admin" | "staff" | "receptionist" | "instructor"
export type StatusFilter = "all" | "active" | "inactive"

export interface StaffMember {
  id: string
  name: string
  email: string
  phone?: string | null
  role: StaffRole
  isActive: boolean
  avatarUrl?: string | null
  createdAt: string
  updatedAt?: string
  lastLogin?: string
  dateOfBirth?: string | null
  bloodGroup?: string | null
  physicalFormUrl?: string | null
}

const INTERNAL_ROLES: StaffRole[] = ["super_admin", "admin", "staff", "receptionist", "instructor"]

interface UseStaffQueryParams {
  searchQuery?: string
  statusFilter?: StatusFilter
  roleFilter?: StaffRole | "all"
}

// Query key factory
const staffKeys = {
  all: ['staff'] as const,
  lists: () => [...staffKeys.all, 'list'] as const,
  list: (filters: UseStaffQueryParams) => [...staffKeys.lists(), filters] as const,
  details: () => [...staffKeys.all, 'detail'] as const,
  detail: (id: string) => [...staffKeys.details(), id] as const,
}

// Fetch staff from API
async function fetchStaff(filters: UseStaffQueryParams, cacheBuster?: number): Promise<StaffMember[]> {
  const params = new URLSearchParams()
  
  if (filters.statusFilter && filters.statusFilter !== "all") {
    params.append("isActive", filters.statusFilter === "active" ? "true" : "false")
  }
  if (filters.searchQuery) {
    params.append("search", filters.searchQuery)
  }
  if (filters.roleFilter && filters.roleFilter !== "all") {
    params.append("role", filters.roleFilter)
  }
  
  params.append("pageSize", "100") // Get all staff in one call
  
  // Add cache-busting parameters
  if (cacheBuster) params.append('cb', String(cacheBuster))
  params.append('_t', String(Date.now()))

  const response = await api.get<{ data: any[] }>(`/api/users?${params.toString()}`)

  if (response.error) {
    throw new Error(response.error.message || "Failed to fetch staff")
  }

  // Filter to only internal roles and map to StaffMember format
  const internalStaff: StaffMember[] = (response.data?.data || [])
    .filter((member: any) => INTERNAL_ROLES.includes(member.role as StaffRole))
    .map((member: any) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role as StaffRole,
      isActive: member.isActive,
      avatarUrl: member.avatarUrl,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      lastLogin: member.lastLogin || undefined,
      dateOfBirth: member.dateOfBirth || null,
      bloodGroup: member.bloodGroup || null,
      physicalFormUrl: member.physicalFormUrl || null,
    }))

  return internalStaff
}

// Hook to fetch staff with caching
export function useStaff(filters: UseStaffQueryParams = {}, options?: { cacheBuster?: number }) {
  return useQuery({
    queryKey: [...staffKeys.list(filters), options?.cacheBuster || 0], // Include cacheBuster in key to force refetch
    queryFn: () => fetchStaff(filters, options?.cacheBuster),
    staleTime: 0, // Always stale so refetch works
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes
  })
}

// Hook to fetch a single staff member
export function useStaffMember(id: string) {
  return useQuery({
    queryKey: staffKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<{ data: any }>(`/api/users/${id}`)
      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch staff member")
      }
      const member = response.data?.data
      // Map to StaffMember format
      return {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role as StaffRole,
        isActive: member.isActive,
        avatarUrl: member.avatarUrl,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        lastLogin: member.lastLogin || undefined,
        dateOfBirth: member.dateOfBirth || null,
        bloodGroup: member.bloodGroup || null,
        physicalFormUrl: member.physicalFormUrl || null,
      } as StaffMember
    },
    enabled: !!id, // Only fetch if ID is provided
    staleTime: 0, // Always stale so refetch works
    gcTime: 10 * 60 * 1000,
  })
}

// Hook to invalidate staff cache (call after mutations)
export function useInvalidateStaff() {
  const queryClient = useQueryClient()
  
  return {
    invalidateAll: () => queryClient.invalidateQueries({ 
      queryKey: staffKeys.all,
      refetchType: 'active',
    }),
    invalidateList: (filters?: UseStaffQueryParams) => {
      if (filters) {
        queryClient.invalidateQueries({ 
          queryKey: staffKeys.list(filters),
          refetchType: 'active',
        })
      } else {
        queryClient.invalidateQueries({ 
          queryKey: staffKeys.lists(),
          refetchType: 'active',
        })
      }
    },
    invalidateDetail: (id: string) => {
      queryClient.invalidateQueries({ 
        queryKey: staffKeys.detail(id),
        refetchType: 'active',
      })
    },
  }
}

