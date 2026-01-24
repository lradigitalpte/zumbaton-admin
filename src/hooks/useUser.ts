import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface UserDetail {
  id: string
  name: string
  email: string
  phone?: string | null
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
  status: "active" | "flagged" | "inactive"
  joinedDate: string
  lastActive: string
  // Optional fields
  address?: string
  emergencyContact?: string
  notes?: string
  // New fields
  dateOfBirth?: string | null
  bloodGroup?: string | null
  physicalFormUrl?: string | null
  registrationFormId?: string | null
  registrationFormSentAt?: string | null
  // Early bird fields
  earlyBirdEligible?: boolean
  earlyBirdGrantedAt?: string | null
  earlyBirdExpiresAt?: string | null
}

// Query key factory
const userKeys = {
  all: ['user'] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
}

// Helper to compute status from isActive and isFlagged
function computeStatus(isActive: boolean, isFlagged: boolean): "active" | "flagged" | "inactive" {
  if (isFlagged) return "flagged"
  if (!isActive) return "inactive"
  return "active"
}

// Fetch user detail from API
async function fetchUserDetail(userId: string, cacheBuster?: number): Promise<UserDetail> {
  // Add cache-busting query parameter if provided
  const url = cacheBuster 
    ? `/api/users/${userId}?cb=${cacheBuster}&_t=${Date.now()}`
    : `/api/users/${userId}?_t=${Date.now()}`
  const response = await api.get<{ data: any }>(url)

  if (response.error) {
    throw new Error(response.error.message || "Failed to fetch user")
  }

  if (!response.data?.data) {
    throw new Error("No user data received from API")
  }

  const user = response.data.data
  
  // Log to debug missing fields
  console.log('[useUser] Fetched user data:', {
    id: user.id,
    name: user.name,
    registrationFormSentAt: user.registrationFormSentAt,
    registrationFormId: user.registrationFormId,
  })
  
  const status = computeStatus(user.isActive, user.isFlagged || false)

  // Map API response to UserDetail interface
  // The API returns UserProfileWithStats which includes stats and token balance
  const userDetail: UserDetail = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    avatarUrl: user.avatarUrl || null,
    role: user.role,
    isActive: user.isActive,
    isFlagged: user.isFlagged || false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    // Enhanced data from API (UserProfileWithStats structure)
    tokenBalance: user.currentTokenBalance || 0,
    totalClasses: user.stats?.totalClassesBooked || 0,
    noShows: user.stats?.totalNoShows || 0,
    joinedDate: user.createdAt, // Map createdAt to joinedDate
    lastActive: user.updatedAt || user.createdAt,
    status, // Computed status
    // Optional fields - these might not be in the API yet, check preferences
    address: (user.preferences as any)?.address || undefined,
    emergencyContact: (user.preferences as any)?.emergencyContact || undefined,
    notes: (user.preferences as any)?.notes || undefined,
    // New fields from database
    dateOfBirth: user.dateOfBirth || null,
    bloodGroup: user.bloodGroup || null,
    physicalFormUrl: user.physicalFormUrl || null,
    registrationFormId: user.registrationFormId || null,
    registrationFormSentAt: user.registrationFormSentAt || null,
    // Early bird fields
    earlyBirdEligible: user.earlyBirdEligible || false,
    earlyBirdGrantedAt: user.earlyBirdGrantedAt || null,
    earlyBirdExpiresAt: user.earlyBirdExpiresAt || null,
  }

  return userDetail
}

// Hook to fetch user detail with caching
export function useUser(userId: string, cacheBuster?: number) {
  return useQuery({
    queryKey: [...userKeys.detail(userId), cacheBuster || 0], // Include cacheBuster in key to force refetch
    queryFn: () => fetchUserDetail(userId, cacheBuster),
    enabled: !!userId, // Only fetch if userId is provided
    staleTime: 0, // Always stale so refetch works
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

// Hook to invalidate user cache
export function useInvalidateUser() {
  const queryClient = useQueryClient()
  
  return {
    invalidateDetail: (userId: string) => {
      queryClient.invalidateQueries({ 
        queryKey: userKeys.detail(userId),
        refetchType: 'active',
      })
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ 
        queryKey: userKeys.all,
        refetchType: 'active',
      })
    },
  }
}

