'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface PendingPayment {
  id: string
  userId: string
  userName: string
  userEmail: string
  packageName: string
  tokenCount: number
  amountCents: number
  originalAmountCents: number
  currency: string
  status: string
  provider: string | null
  hitpayPaymentRequestId: string | null
  hitpayPaymentId: string | null
  promoType: string | null
  discountPercent: number
  discountAmountCents: number
  createdAt: string
  updatedAt: string
}

async function fetchPendingPayments(): Promise<PendingPayment[]> {
  const response = await api.get<{ success: boolean; data: PendingPayment[] }>('/api/payments/pending')
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch pending payments')
  }
  return response.data?.data || []
}

export function usePendingPayments() {
  return useQuery({
    queryKey: ['pending-payments'],
    queryFn: fetchPendingPayments,
    staleTime: 20 * 1000, // 20 seconds
    refetchOnWindowFocus: true,
  })
}

export function useSyncPayment() {
  const queryClient = useQueryClient()
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())
  const [syncResults, setSyncResults] = useState<Record<string, { success: boolean; message: string }>>({})

  const syncPayment = async (paymentId: string) => {
    setSyncingIds(prev => new Set(prev).add(paymentId))
    setSyncResults(prev => {
      const next = { ...prev }
      delete next[paymentId]
      return next
    })

    try {
      const response = await api.post<{
        message: string
        status: string
        tokensIssued?: number
        packageName?: string
        hitpayStatus?: string
      }>(`/api/payments/${paymentId}/sync`, {})

      if (response.error) {
        setSyncResults(prev => ({
          ...prev,
          [paymentId]: { success: false, message: response.error?.message || 'Sync failed' },
        }))
        return false
      }

      const result = response.data
      const isConfirmed = result?.status === 'succeeded' || result?.status === 'completed'

      setSyncResults(prev => ({
        ...prev,
        [paymentId]: {
          success: isConfirmed,
          message: isConfirmed
            ? `✓ Confirmed — ${result?.tokensIssued ?? ''} tokens issued`
            : result?.message ?? `HitPay status: ${result?.hitpayStatus ?? 'still pending'}`,
        },
      }))

      if (isConfirmed) {
        // Refresh both queries
        await queryClient.invalidateQueries({ queryKey: ['pending-payments'] })
        await queryClient.invalidateQueries({ queryKey: ['token-transactions'] })
      }

      return isConfirmed
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setSyncResults(prev => ({
        ...prev,
        [paymentId]: { success: false, message: msg },
      }))
      return false
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev)
        next.delete(paymentId)
        return next
      })
    }
  }

  return { syncPayment, syncingIds, syncResults }
}
