/**
 * useDashboard Hook
 * 
 * Provides React Query hooks for the Dashboard API
 */

import { useQuery } from '@tanstack/react-query'

// Types for Dashboard data
export interface DashboardMetrics {
  activeMembers: number
  usersChange: number
  tokensSold: number
  tokensChange: number
  classesToday: number
  attendanceToday: number
  attendanceRate: number
  revenue: number
  revenueChange: number
}

export interface TodaysClass {
  id: string
  title: string
  instructor: string
  time: string
  capacity: number
  booked: number
  checkedIn: number
  status: 'upcoming' | 'in-progress' | 'completed'
}

export interface RecentActivityItem {
  id: string
  type: 'booking' | 'check-in' | 'cancellation' | 'purchase' | 'no-show'
  user: string
  description: string
  time: string
}

export interface DashboardData {
  metrics: DashboardMetrics
  todaysClasses: TodaysClass[]
  recentActivity: RecentActivityItem[]
}

// Query key for dashboard data
export const dashboardQueryKey = ['dashboard']

/**
 * Fetch dashboard data from the API
 */
async function fetchDashboard(): Promise<DashboardData> {
  const response = await fetch('/api/dashboard')
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data')
  }
  const json = await response.json()
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch dashboard data')
  }
  return json.data
}

/**
 * Hook to fetch all dashboard data
 * 
 * Dashboard uses shorter staleTime (5 min) since it shows live metrics
 * Auto-refetch disabled by default - use manual refresh button
 */
export function useDashboard() {
  return useQuery({
    queryKey: dashboardQueryKey,
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000, // 5 minutes for dashboard (more frequent than other pages)
    // No auto-refetch - use manual refresh button
  })
}

/**
 * Hook to get just the metrics from dashboard
 */
export function useDashboardMetrics() {
  const query = useDashboard()
  
  return {
    ...query,
    data: query.data?.metrics,
  }
}

/**
 * Hook to get just today's classes
 */
export function useTodaysClasses() {
  const query = useDashboard()
  
  return {
    ...query,
    data: query.data?.todaysClasses,
  }
}

/**
 * Hook to get just recent activity
 */
export function useRecentActivity() {
  const query = useDashboard()
  
  return {
    ...query,
    data: query.data?.recentActivity,
  }
}
