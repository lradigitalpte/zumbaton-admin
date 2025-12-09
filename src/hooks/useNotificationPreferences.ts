import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface NotificationChannel {
  email: boolean
  push: boolean
  sms: boolean
}

export interface GranularNotificationPreferences {
  // Booking notifications
  new_booking: NotificationChannel
  booking_cancelled: NotificationChannel
  waitlist_promotion: NotificationChannel
  no_show: NotificationChannel
  
  // Token notifications
  token_purchase: NotificationChannel
  low_token_alert: NotificationChannel
  token_expiry: NotificationChannel
  token_adjustment: NotificationChannel
  
  // System notifications
  new_user: NotificationChannel
  flagged_user: NotificationChannel
  daily_summary: NotificationChannel
  weekly_report: NotificationChannel
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

