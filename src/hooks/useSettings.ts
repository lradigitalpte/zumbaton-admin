import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface BusinessSettings {
  businessName: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  timezone: string
  currency: string
  language: string
}

export interface BookingSettings {
  maxBookingsPerUser: number
  cancellationWindow: number
  noShowPenalty: boolean
  noShowPenaltyTokens: number
  waitlistEnabled: boolean
  autoConfirmBookings: boolean
  reminderHoursBefore: number
}

export interface TokenSettings {
  tokenExpiryDays: number
  allowTokenTransfer: boolean
  minPurchaseTokens: number
  maxPurchaseTokens: number
}

export interface AppearanceSettings {
  primaryColor: string
  accentColor: string
  logoUrl: string
  darkModeDefault: boolean
}

export interface SystemSettings {
  business: BusinessSettings
  booking: BookingSettings
  tokens: TokenSettings
  appearance: AppearanceSettings
}

export interface UpdateSettingsData {
  business?: Partial<BusinessSettings>
  booking?: Partial<BookingSettings>
  tokens?: Partial<TokenSettings>
  appearance?: Partial<AppearanceSettings>
}

async function fetchSettings(): Promise<SystemSettings> {
  const response = await api.get<{ success: boolean; data: SystemSettings }>('/api/settings')

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch settings')
  }

  if (!response.data?.success) {
    throw new Error('Failed to fetch settings')
  }

  return response.data.data
}

async function updateSettings(data: UpdateSettingsData): Promise<{ message: string }> {
  const response = await api.patch<{ success: boolean; data: { message: string } }>('/api/settings', data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to update settings')
  }

  if (!response.data?.success) {
    const errorMessage = (response.data as any)?.error?.message || 'Failed to update settings'
    throw new Error(errorMessage)
  }

  return response.data.data
}

export function useSettings() {
  return useQuery({
    queryKey: ['system-settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      // Invalidate and refetch settings
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
    },
  })
}

