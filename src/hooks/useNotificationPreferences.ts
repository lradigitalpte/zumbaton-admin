import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface NotificationChannel {
  email: boolean
  push: boolean
  sms: boolean
}

export interface GranularNotificationPreferences {
  // Booking notifications
  booking_confirmation: NotificationChannel    // When you/someone books a class
  booking_cancelled: NotificationChannel       // When you/someone cancels a booking
  booking_reminder: NotificationChannel        // Class reminder 2 hours before
  waitlist_promotion: NotificationChannel      // When promoted from waitlist
  no_show_warning: NotificationChannel         // After a no-show
  class_cancelled: NotificationChannel         // When admin cancels a class
  
  // Token notifications
  token_purchase: NotificationChannel          // When tokens are purchased
  token_balance_low: NotificationChannel       // When token balance is low
  package_expiring: NotificationChannel        // When package is about to expire
  
  // System notifications
  welcome: NotificationChannel                 // Welcome notification on signup
  payment_successful: NotificationChannel      // After successful payment
  general: NotificationChannel                 // General announcements
}

export interface NotificationPreferences {
  emailEnabled: boolean
  pushEnabled: boolean
  smsEnabled: boolean
  bookingReminders: boolean
  marketingEmails: boolean
  granular: GranularNotificationPreferences
}

export interface UpdateNotificationPreferencesData {
  emailEnabled?: boolean
  pushEnabled?: boolean
  smsEnabled?: boolean
  bookingReminders?: boolean
  marketingEmails?: boolean
  granular?: Partial<GranularNotificationPreferences>
}

async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await api.get<{ success: boolean; data: NotificationPreferences }>('/api/notifications/preferences')

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch notification preferences')
  }

  if (!response.data?.success) {
    throw new Error('Failed to fetch notification preferences')
  }

  return response.data.data
}

async function updateNotificationPreferences(data: UpdateNotificationPreferencesData): Promise<NotificationPreferences> {
  const response = await api.put<{ success: boolean; data: NotificationPreferences }>('/api/notifications/preferences', data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to update notification preferences')
  }

  if (!response.data?.success) {
    const errorMessage = (response.data as any)?.error?.message || 'Failed to update notification preferences'
    throw new Error(errorMessage)
  }

  return response.data.data
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      // Invalidate and refetch preferences
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })
}

