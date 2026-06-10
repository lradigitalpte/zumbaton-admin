'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export type PackageExpiryFilter = 'expiring_soon' | 'expired'

export interface PackageExpiryItem {
  id: string
  userId: string
  userName: string
  userEmail: string
  userAvatar: string | null
  packageId: string | null
  packageName: string
  tokensRemaining: number
  tokensHeld: number
  availableTokens: number
  expiresAt: string
  purchasedAt: string
  status: string
  daysUntilExpiry: number
  daysSinceExpiry: number
  isPastExpiry: boolean
  isProcessed: boolean
  stillHasTokens: boolean
}

export interface PackageExpiryCounts {
  expiringSoon: number
  expired: number
}

export interface PackageExpiryResponse {
  items: PackageExpiryItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  counts: PackageExpiryCounts
}

export interface UseTokenPackageExpiryParams {
  filter: PackageExpiryFilter
  search?: string
  page?: number
  pageSize?: number
  enabled?: boolean
}

async function fetchPackageExpiry(params: UseTokenPackageExpiryParams): Promise<PackageExpiryResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('filter', params.filter)
  if (params.search) searchParams.set('search', params.search)
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())

  const response = await api.get<{ success: boolean; data: PackageExpiryResponse }>(
    `/api/tokens/package-expiry?${searchParams.toString()}`
  )

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch package expiry data')
  }

  return (
    response.data?.data || {
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      counts: { expiringSoon: 0, expired: 0 },
    }
  )
}

async function fetchPackageExpiryCounts(): Promise<PackageExpiryCounts> {
  const response = await api.get<{ success: boolean; data: PackageExpiryCounts }>(
    '/api/tokens/package-expiry/counts'
  )

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch expiry counts')
  }

  return response.data?.data || { expiringSoon: 0, expired: 0 }
}

/** Single source of truth for tab badge numbers */
export function useTokenPackageExpiryCounts() {
  return useQuery({
    queryKey: ['token-package-expiry-counts'],
    queryFn: fetchPackageExpiryCounts,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
  })
}

export function useTokenPackageExpiry(params: UseTokenPackageExpiryParams) {
  const { enabled = true, ...queryParams } = params
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['token-package-expiry', queryParams],
    queryFn: async () => {
      const data = await fetchPackageExpiry(queryParams)
      if (!queryParams.search) {
        queryClient.setQueryData(['token-package-expiry-counts'], data.counts)
      }
      return data
    },
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
    enabled,
  })
}
