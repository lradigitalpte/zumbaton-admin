'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// Transaction type from the page
export type TransactionType = 
  | 'purchase' 
  | 'booking-hold' 
  | 'booking-release' 
  | 'attendance-consume'
  | 'no-show-consume'
  | 'late-cancel-consume'
  | 'admin-adjust'
  | 'refund'
  | 'expire'

export interface TokenTransaction {
  id: string
  userId: string
  userName: string
  userEmail: string
  userPackageId: string | null
  bookingId: string | null
  type: TransactionType
  amount: number
  balance: number
  description: string | null
  performedBy: string | null
  createdAt: string
  reference: string | null
}

export interface TransactionStats {
  totalPurchased: number
  totalConsumed: number
  totalExpired: number
  totalAdjusted: number
  totalReleased: number
  todayTransactions: number
}

export interface TransactionsResponse {
  transactions: TokenTransaction[]
  stats: TransactionStats
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface UseTokenTransactionsParams {
  type?: string
  startDate?: string
  endDate?: string
  search?: string
  page?: number
  pageSize?: number
}

async function fetchTransactions(params: UseTokenTransactionsParams): Promise<TransactionsResponse> {
  const searchParams = new URLSearchParams()
  
  if (params.type && params.type !== 'all') {
    searchParams.append('type', params.type)
  }
  if (params.startDate) {
    searchParams.append('startDate', params.startDate)
  }
  if (params.endDate) {
    searchParams.append('endDate', params.endDate)
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
  const url = `/api/tokens/transactions${queryString ? `?${queryString}` : ''}`
  
  const response = await api.get<{ 
    success: boolean
    data: TransactionsResponse 
  }>(url)
  
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch transactions')
  }
  
  return response.data?.data || {
    transactions: [],
    stats: {
      totalPurchased: 0,
      totalConsumed: 0,
      totalExpired: 0,
      totalAdjusted: 0,
      totalReleased: 0,
      todayTransactions: 0,
    },
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
  }
}

export function useTokenTransactions(params: UseTokenTransactionsParams = {}) {
  return useQuery({
    queryKey: ['token-transactions', params],
    queryFn: () => fetchTransactions(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}
