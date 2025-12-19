import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '@/lib/api-client'
import { getSupabaseClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast as useAdminToast } from '@/components/ui/Toast'
import { handleApiResponse, handleMutationError, createToastAdapter } from '@/lib/toast-helper'

export interface Notification {
  id: string
  userId: string
  templateId: string | null
  type: string
  channel: 'email' | 'push' | 'sms' | 'in_app'
  subject: string | null
  body: string
  data: Record<string, unknown>
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read'
  sentAt: string | null
  readAt: string | null
  errorMessage: string | null
  createdAt: string
}

export interface NotificationsResponse {
  data: Notification[]
  unreadCount: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

async function fetchNotifications(params?: {
  page?: number
  limit?: number
  unreadOnly?: boolean
  channel?: 'email' | 'push' | 'sms' | 'in_app'
}): Promise<NotificationsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.unreadOnly) searchParams.set('unreadOnly', 'true')
  if (params?.channel) searchParams.set('channel', params.channel)

  const url = `/api/notifications${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const response = await api.get<NotificationsResponse>(url)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch notifications')
  }

  if (!response.data) {
    throw new Error('No data received from notifications API')
  }

  return response.data
}

async function markNotificationRead(notificationId: string): Promise<void> {
  const response = await api.patch(`/api/notifications/${notificationId}`, {})

  if (response.error) {
    throw new Error(response.error.message || 'Failed to mark notification as read')
  }
}

async function markAllNotificationsRead(): Promise<void> {
  const response = await api.post('/api/notifications/read-all', {})

  if (response.error) {
    throw new Error(response.error.message || 'Failed to mark all notifications as read')
  }
}

export function useNotifications(params?: {
  page?: number
  limit?: number
  unreadOnly?: boolean
  channel?: 'email' | 'push' | 'sms' | 'in_app'
}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => fetchNotifications(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute as fallback
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  const adminToast = useAdminToast()
  const toast = createToastAdapter(adminToast)

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      // Invalidate notifications queries
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      // No toast on single mark as read (user action, not significant)
    },
    onError: (error: Error) => {
      handleMutationError(error, toast, 'Mark as read')
    }
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  const adminToast = useAdminToast()
  const toast = createToastAdapter(adminToast)

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      // Invalidate notifications queries
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      handleApiResponse({ success: true, message: 'All notifications marked as read' }, toast, {
        successTitle: 'Marked as Read'
      })
    },
    onError: (error: Error) => {
      handleMutationError(error, toast, 'Mark all as read')
    }
  })
}

// Hook to set up real-time subscription for notifications
export function useNotificationsRealtime() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    const supabase = getSupabaseClient()

    // Subscribe to changes on the notifications table for this user
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Notification real-time update:', payload)

          // Invalidate queries to refetch notifications
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, queryClient])
}

