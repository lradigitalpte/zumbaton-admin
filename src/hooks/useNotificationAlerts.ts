import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface NotificationAlertsSettings {
  emails: string[]
  updatedAt?: string | null
}

async function fetchNotificationAlertsSettings(): Promise<NotificationAlertsSettings> {
  const response = await api.get<{ success: boolean; data: NotificationAlertsSettings }>(
    '/api/settings/notification-alerts'
  )

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch alert email settings')
  }

  return response.data?.data || { emails: [] }
}

async function updateNotificationAlertsSettings(
  settings: Pick<NotificationAlertsSettings, 'emails'>
): Promise<NotificationAlertsSettings> {
  const response = await api.put<{ success: boolean; data: NotificationAlertsSettings }>(
    '/api/settings/notification-alerts',
    settings
  )

  if (response.error) {
    throw new Error(response.error.message || 'Failed to update alert email settings')
  }

  return response.data?.data || settings
}

export function useNotificationAlertsSettings() {
  return useQuery({
    queryKey: ['notification-alerts-settings'],
    queryFn: fetchNotificationAlertsSettings,
    staleTime: 60 * 1000,
  })
}

export function useUpdateNotificationAlertsSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateNotificationAlertsSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-alerts-settings'] })
    },
  })
}
