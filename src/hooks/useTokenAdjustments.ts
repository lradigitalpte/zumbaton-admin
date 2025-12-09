'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// Types
export type AdjustmentType = 'credit' | 'debit' | 'correction' | 'promo' | 'refund'
export type AdjustmentStatus = 'pending' | 'approved' | 'rejected' | 'completed'

export interface TokenAdjustment {
  id: string
  oderId: string
  userId: string
  userName: string
  userEmail: string
  type: AdjustmentType
  amount: number
  reason: string
  notes: string | null
  status: AdjustmentStatus
  requestedBy: string
  requestedAt: string
  approvedBy: string | null
  approvedAt: string | null
  completedAt: string | null
  balanceBefore: number | null
  balanceAfter: number | null
  transactionId: string | null
  createdAt: string
}

export interface AdjustmentStats {
  total: number
  pending: number
  approved: number
  completed: number
  rejected: number
  totalCredits: number
  totalDebits: number
}

export interface AdjustmentsResponse {
  adjustments: TokenAdjustment[]
  stats: AdjustmentStats
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface UseAdjustmentsParams {
  status?: string
  type?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface CreateAdjustmentData {
  userId: string
  type: AdjustmentType
  amount: number
  reason: string
  notes?: string
  requestedBy?: string
}

// Query keys
export const adjustmentKeys = {
  all: ['token-adjustments'] as const,
  lists: () => [...adjustmentKeys.all, 'list'] as const,
  list: (params: UseAdjustmentsParams) => [...adjustmentKeys.lists(), params] as const,
}

// Fetch adjustments
async function fetchAdjustments(params: UseAdjustmentsParams): Promise<AdjustmentsResponse> {
  const searchParams = new URLSearchParams()
  
  if (params.status && params.status !== 'all') {
    searchParams.append('status', params.status)
  }
  if (params.type && params.type !== 'all') {
    searchParams.append('type', params.type)
  }
  if (params.search) {
    searchParams.append('search', params.search)
  }
  if (params.page) {
    searchParams.append('page', params.page.toString())
  }
  if (params.pageSize) {
    searchParams.append('pageSize', params.pageSize.toString())
  }

  const queryString = searchParams.toString()
  const url = `/api/tokens/adjustments${queryString ? `?${queryString}` : ''}`
  
  const response = await api.get<{ 
    success: boolean
    data: AdjustmentsResponse 
  }>(url)
  
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch adjustments')
  }
  
  return response.data?.data || {
    adjustments: [],
    stats: {
      total: 0,
      pending: 0,
      approved: 0,
      completed: 0,
      rejected: 0,
      totalCredits: 0,
      totalDebits: 0,
    },
    total: 0,
    page: 1,
    pageSize: 50,
    hasMore: false,
  }
}

// Create adjustment
async function createAdjustment(data: CreateAdjustmentData): Promise<TokenAdjustment> {
  const response = await api.post<{ 
    success: boolean
    data: { adjustment: TokenAdjustment }
  }>('/api/tokens/adjustments', data)
  
  if (response.error) {
    throw new Error(response.error.message || 'Failed to create adjustment')
  }
  
  return response.data?.data?.adjustment as TokenAdjustment
}

// Update adjustment (approve, reject, complete)
async function updateAdjustment(
  id: string, 
  action: 'approve' | 'reject' | 'complete',
  performedBy?: string
): Promise<TokenAdjustment> {
  const response = await api.patch<{ 
    success: boolean
    data: { adjustment: TokenAdjustment }
  }>(`/api/tokens/adjustments?id=${id}`, { action, performedBy })
  
  if (response.error) {
    throw new Error(response.error.message || 'Failed to update adjustment')
  }
  
  return response.data?.data?.adjustment as TokenAdjustment
}

// Hooks
export function useTokenAdjustments(params: UseAdjustmentsParams = {}) {
  return useQuery({
    queryKey: adjustmentKeys.list(params),
    queryFn: () => fetchAdjustments(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAdjustment,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adjustmentKeys.all,
        refetchType: 'active',
      })
    },
  })
}

export function useApproveAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, performedBy }: { id: string; performedBy?: string }) => 
      updateAdjustment(id, 'approve', performedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adjustmentKeys.all,
        refetchType: 'active',
      })
    },
  })
}

export function useRejectAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => updateAdjustment(id, 'reject'),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adjustmentKeys.all,
        refetchType: 'active',
      })
    },
  })
}

export function useCompleteAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, performedBy }: { id: string; performedBy?: string }) => 
      updateAdjustment(id, 'complete', performedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adjustmentKeys.all,
        refetchType: 'active',
      })
      // Also invalidate token transactions since a new one was created
      queryClient.invalidateQueries({
        queryKey: ['token-transactions'],
        refetchType: 'active',
      })
    },
  })
}
