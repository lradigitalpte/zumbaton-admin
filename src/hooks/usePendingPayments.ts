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
        error?: string
        markedFailed?: boolean
      }>(`/api/payments/${paymentId}/sync`, {})

      if (response.error) {
        setSyncResults(prev => ({
          ...prev,
          [paymentId]: { success: false, message: response.error?.message || 'Sync failed' },
        }))
        setSyncingIds(prev => { const next = new Set(prev); next.delete(paymentId); return next })
        return false
      }

      const result = response.data

      // Payment was not found on HitPay — marked as failed
      if (result?.error === 'not_found_on_hitpay' || result?.markedFailed) {
        setSyncResults(prev => ({
          ...prev,
          [paymentId]: { success: false, message: '⚠ Not found on HitPay — marked as failed (test/abandoned payment)' },
        }))
        await queryClient.invalidateQueries({ queryKey: ['pending-payments'] })
        await queryClient.invalidateQueries({ queryKey: ['token-transactions'] })
        setSyncingIds(prev => { const next = new Set(prev); next.delete(paymentId); return next })
        return false
      }

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

export function useDeletePendingPayment() {
  const queryClient = useQueryClient()
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [deleteResults, setDeleteResults] = useState<Record<string, { success: boolean; message: string }>>({})

  const deletePendingPayment = async (paymentId: string) => {
    setDeletingIds(prev => new Set(prev).add(paymentId))
    setDeleteResults(prev => {
      const next = { ...prev }
      delete next[paymentId]
      return next
    })

    try {
      const response = await api.delete<{ success?: boolean; message?: string }>(`/api/payments/${paymentId}`)

      if (response.error) {
        setDeleteResults(prev => ({
          ...prev,
          [paymentId]: { success: false, message: response.error?.message || 'Delete failed' },
        }))
        return false
      }

      setDeleteResults(prev => ({
        ...prev,
        [paymentId]: { success: true, message: response.data?.message || 'Deleted' },
      }))

      await queryClient.invalidateQueries({ queryKey: ['pending-payments'] })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setDeleteResults(prev => ({
        ...prev,
        [paymentId]: { success: false, message: msg },
      }))
      return false
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(paymentId)
        return next
      })
    }
  }

  return { deletePendingPayment, deletingIds, deleteResults }
}
