/**
 * Reports Hooks
 * React Query hooks for fetching report data
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// Types
export interface ReportStats {
  totalUsers: number
  activeUsers: number
  newUsersThisMonth: number
  userGrowth: number
  totalTokensSold: number
  totalRevenue: number
  revenueGrowth: number
  classesThisMonth: number
  totalClasses: number
  averageAttendance: number
  noShowRate: number
  topInstructor: string
  avgClassSize: number
  peakDay: string
  peakTime: string
}

export interface MonthlyData {
  month: string
  year?: number
  revenue: number
  attendance: number
  newUsers: number
  classes: number
}

export interface TopClass {
  name: string
  instructor: string
  attendance: number
  rating: number
  revenue: number
  growth: number
}

export interface TopInstructor {
  id: string
  name: string
  classes: number
  students: number
  rating: number
  revenue: number
}

export interface RecentActivity {
  type: 'purchase' | 'class' | 'signup' | 'noshow'
  user: string
  detail: string
  time: string
  amount: number | null
}

export interface ReportsOverviewData {
  stats: ReportStats
  monthlyData: MonthlyData[]
  topClasses: TopClass[]
  topInstructors: TopInstructor[]
  recentActivity: RecentActivity[]
}

// Revenue types
export interface RevenueSummary {
  totalRevenue: number
  totalTransactions: number
  avgMonthlyRevenue: number
  growth: number
  thisMonth: number
  lastMonth: number
  avgOrderValue: number
}

export interface MonthlyRevenue {
  month: string
  packages: number
  classes: number
  total: number
  transactions: number
  avgOrder: number
}

export interface PackageSale {
  name: string
  sales: number
  revenue: number
  percentage: number
}

export interface TopCustomer {
  name: string
  email: string
  spent: number
  purchases: number
  tokens: number
}

export interface RecentTransaction {
  id: string
  user: string
  package: string
  amount: number
  date: string
  method: string
}

export interface RevenueReportData {
  summary: RevenueSummary
  monthlyRevenue: MonthlyRevenue[]
  packageSales: PackageSale[]
  topCustomers: TopCustomer[]
  recentTransactions: RecentTransaction[]
}

// Attendance types
export interface AttendanceTotals {
  totalBooked: number
  totalAttended: number
  totalNoShows: number
  totalCancelled: number
  overallRate: number
  noShowRate: number
}

export interface WeeklyData {
  day: string
  classes: number
  booked: number
  attended: number
  noShows: number
  cancelled: number
  rate: number
}

export interface TimeSlotData {
  slot: string
  classes: number
  avgAttendance: number
  rate: number
}

export interface ClassPerformance {
  name: string
  instructor: string
  totalClasses: number
  avgAttendance: number
  capacity: number
  rate: number
  noShowRate: number
}

export interface FrequentNoShow {
  name: string
  email: string
  noShows: number
  totalBookings: number
  rate: number
  lastNoShow: string
}

export interface MonthlyTrend {
  month: string
  year?: number
  attendance: number
  noShows: number
  cancellations: number
  rate: number
}

export interface AttendanceReportData {
  totals: AttendanceTotals
  weeklyData: WeeklyData[]
  timeSlotData: TimeSlotData[]
  classPerformance: ClassPerformance[]
  frequentNoShows: FrequentNoShow[]
  monthlyTrends: MonthlyTrend[]
}

// Audits types
export interface AuditLog {
  id: string
  userId: string | null
  userName: string
  userEmail: string | null
  userRole: string | null
  action: string
  resourceType: string
  resourceId: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export interface AuditStats {
  totalLogs: number
  todayLogs: number
  uniqueUsers: number
  uniqueActions: number
  uniqueResources: number
}

export interface AuditReportData {
  logs: AuditLog[]
  stats: AuditStats
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

type DateRange = 'week' | 'month' | 'quarter' | 'year'

// Fetch functions
async function fetchReportsOverview(range: DateRange): Promise<ReportsOverviewData> {
  const response = await fetch(`/api/reports?range=${range}`)
  if (!response.ok) {
    throw new Error('Failed to fetch reports overview')
  }
  const json = await response.json()
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch reports')
  }
  return json.data
}

async function fetchRevenueReport(range: DateRange): Promise<RevenueReportData> {
  const response = await fetch(`/api/reports/revenue?range=${range}`)
  if (!response.ok) {
    throw new Error('Failed to fetch revenue report')
  }
  const json = await response.json()
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch revenue report')
  }
  return json.data
}

async function fetchAttendanceReport(range: DateRange): Promise<AttendanceReportData> {
  const response = await fetch(`/api/reports/attendance?range=${range}`)
  if (!response.ok) {
    throw new Error('Failed to fetch attendance report')
  }
  const json = await response.json()
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch attendance report')
  }
  return json.data
}

async function fetchAuditReport(params: {
  action?: string
  resourceType?: string
  startDate?: string
  endDate?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<AuditReportData> {
  const queryParams = new URLSearchParams()
  if (params.action) queryParams.append('action', params.action)
  if (params.resourceType) queryParams.append('resourceType', params.resourceType)
  if (params.startDate) queryParams.append('startDate', params.startDate)
  if (params.endDate) queryParams.append('endDate', params.endDate)
  if (params.search) queryParams.append('search', params.search)
  if (params.page) queryParams.append('page', params.page.toString())
  if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString())

  const queryString = queryParams.toString()
  const url = `/api/reports/audits${queryString ? `?${queryString}` : ''}`
  
  const response = await api.get<{ 
    success: boolean
    data: AuditReportData 
  }>(url)
  
  if (response.error) {
    if (response.error.code === 'FORBIDDEN' || response.error.code === 'UNAUTHORIZED') {
      throw new Error(response.error.message || 'You do not have permission to view audit logs')
    }
    throw new Error(response.error.message || 'Failed to fetch audit report')
  }
  
  return response.data?.data || {
    logs: [],
    stats: {
      totalLogs: 0,
      todayLogs: 0,
      uniqueUsers: 0,
      uniqueActions: 0,
      uniqueResources: 0,
    },
    total: 0,
    page: 1,
    pageSize: 50,
    hasMore: false,
  }
}

// Hooks
export function useReportsOverview(range: DateRange = 'month') {
  return useQuery({
    queryKey: ['reports', 'overview', range],
    queryFn: () => fetchReportsOverview(range),
    // Uses global 30-minute staleTime from react-query.tsx
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

export function useRevenueReport(range: DateRange = 'month') {
  return useQuery({
    queryKey: ['reports', 'revenue', range],
    queryFn: () => fetchRevenueReport(range),
    // Uses global 30-minute staleTime from react-query.tsx
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

export function useAttendanceReport(range: DateRange = 'month') {
  return useQuery({
    queryKey: ['reports', 'attendance', range],
    queryFn: () => fetchAttendanceReport(range),
    // Uses global 30-minute staleTime from react-query.tsx
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

export function useAuditReport(params: {
  action?: string
  resourceType?: string
  startDate?: string
  endDate?: string
  search?: string
  page?: number
  pageSize?: number
} = {}) {
  return useQuery({
    queryKey: ['reports', 'audits', params],
    queryFn: () => fetchAuditReport(params),
    // Uses global 30-minute staleTime from react-query.tsx
  })
}
