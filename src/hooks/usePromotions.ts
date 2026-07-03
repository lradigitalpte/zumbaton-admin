import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useToast as useAdminToast } from '@/components/ui/Toast'

export type DuoBookingMode = 'pay_online' | 'reserve_only' | 'both'
export type DuoPaymentTerms = 'full' | 'deposit' | 'none'
export type OutdoorQuickJoinMode = 'auto' | 'on' | 'off'
export type StartPageMode = 'quick_join' | 'trial'

export interface PromotionsSettings {
  early_bird_enabled: boolean
  early_bird_limit: number
  early_bird_discount_percent: number
  early_bird_validity_months: number
  referral_enabled: boolean
  referral_discount_percent: number
  // Duo Trial (1-for-1) promo
  duo_promo_active: boolean
  duo_indoor_price_cents: number
  duo_outdoor_price_cents: number
  duo_booking_mode: DuoBookingMode
  duo_payment_terms: DuoPaymentTerms
  duo_deposit_percent: number
  duo_end_date: string
  /** Outdoor option on /start: auto = when outdoor classes are scheduled. */
  duo_outdoor_quick_join_mode: OutdoorQuickJoinMode
  duo_start_page_mode: StartPageMode
}

async function fetchPromotionsSettings(): Promise<PromotionsSettings> {
  const response = await api.get<{ success: boolean; data: PromotionsSettings }>('/api/settings/promotions')

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch promotions settings')
  }

  return response.data?.data || getDefaultSettings()
}

async function updatePromotionsSettings(settings: PromotionsSettings): Promise<PromotionsSettings> {
  const response = await api.put<{ success: boolean; data: PromotionsSettings }>('/api/settings/promotions', settings)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to update promotions settings')
  }

  return response.data?.data || settings
}

function getDefaultSettings(): PromotionsSettings {
  return {
    early_bird_enabled: true,
    early_bird_limit: 40,
    early_bird_discount_percent: 10,
    early_bird_validity_months: 2,
    referral_enabled: true,
    referral_discount_percent: 8,
    duo_promo_active: true,
    duo_indoor_price_cents: 2300,
    duo_outdoor_price_cents: 3500,
    duo_booking_mode: 'pay_online',
    duo_payment_terms: 'full',
    duo_deposit_percent: 50,
    duo_end_date: '',
    duo_outdoor_quick_join_mode: 'auto',
    duo_start_page_mode: 'quick_join',
  }
}

export function usePromotionsSettings() {
  return useQuery({
    queryKey: ['promotions', 'settings'],
    queryFn: fetchPromotionsSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  })
}

export function useUpdatePromotionsSettings() {
  const queryClient = useQueryClient()
  const toast = useAdminToast()

  return useMutation({
    mutationFn: updatePromotionsSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['promotions', 'settings'], data)
      toast.showToast('Promotions settings updated successfully', 'success')
    },
    onError: (error) => {
      toast.showToast(
        error instanceof Error ? error.message : 'Failed to update promotions settings',
        'error'
      )
    },
  })
}
