import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useToast as useAdminToast } from '@/components/ui/Toast'

export interface PromotionsSettings {
  early_bird_enabled: boolean
  early_bird_limit: number
  early_bird_discount_percent: number
  early_bird_validity_months: number
  referral_enabled: boolean
  referral_discount_percent: number
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
