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
  packageRevenue?: number
  trialRevenue?: number
  paymentCount?: number
  totalBookings?: number
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
  monthNumber?: number
  year?: number
  revenue: number
  attendance: number
  newUsers: number
  classes: number
}

export interface ReportsOverviewParams {
  year: number
  month?: number | null
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
  periodLabel?: string
  year?: number
  month?: number | null
  stats: ReportStats
  monthlyData: MonthlyData[]
  topClasses: TopClass[]
  topInstructors: TopInstructor[]
  recentActivity: RecentActivity[]
}

// Revenue types
export interface RevenueReportParams {
  year: number
  month?: number | null
}

export interface RevenueSummary {
  totalRevenue: number
  totalTransactions: number
  avgMonthlyRevenue: number
  growth: number
  thisMonth: number
  lastMonth: number
  prevPeriodRevenue?: number
  avgOrderValue: number
  packageRevenue?: number
  classRevenue?: number
}

export interface MonthlyRevenue {
  month: string
  monthNumber?: number
  year?: number
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
  periodLabel?: string
  year?: number
  month?: number | null
  summary: RevenueSummary
  monthlyRevenue: MonthlyRevenue[]
  packageSales: PackageSale[]
  topCustomers: TopCustomer[]
  recentTransactions: RecentTransaction[]
}

// Marketing demographics types
export interface MarketingReportParams {
  year: number
  month?: number | null
}

export interface DemographicCount {
  label: string
  count: number
  percentage: number
  key?: string
}

export interface DemographicBreakdown {
  segment: 'trial' | 'member'
  total: number
  withGender: number
  withAge: number
  genderCoverage: number
  ageCoverage: number
  avgAge: number | null
  medianAge?: number | null
  kidsUnder13?: number
  minorsUnder18?: number
  adults18Plus?: number
  kidsPct?: number
  minorsPct?: number
  gender: DemographicCount[]
  ageGroups: DemographicCount[]
}

export interface CombinedAgeGroup {
  key: string
  label: string
  shortLabel: string
  trial: number
  members: number
  total: number
  trialPct: number
  membersPct: number
}

export interface MarketingSummary {
  trialUsers: number
  members: number
  trialAgeCoverage: number
  memberAgeCoverage: number
  trialAvgAge: number | null
  memberAvgAge: number | null
  trialMedianAge?: number | null
  memberMedianAge?: number | null
  trialKidsPct?: number
  memberKidsPct?: number
}

export interface MonthlyAudienceTrend {
  month: string
  monthNumber: number
  year: number
  trialBookings: number
  newMembers: number
}

export interface MarketingReportData {
  periodLabel?: string
  year?: number
  month?: number | null
  summary: MarketingSummary
  trial: DemographicBreakdown
  members: DemographicBreakdown
  combinedAgeGroups?: CombinedAgeGroup[]
  monthlyTrend: MonthlyAudienceTrend[]
  dataNotes?: string[]
}

// Attendance / booking types
export interface BookingTotals {
  totalClasses: number
  classesWithBookings: number
  totalBookings: number
  memberBookings: number
  trialBookings: number
}

export interface ClassSession {
  id: string
  title: string
  instructor: string
  scheduledAt: string
  dateLabel: string
  timeLabel: string
  capacity: number
  totalBookings: number
  memberBookings: number
  trialBookings: number
  hasBookings: boolean
}

export interface YearMonthSummary extends BookingTotals {
  month: number
  monthName: string
  year: number
}

export interface AttendanceReportParams {
  year: number
  month: number
  scope: 'month' | 'year'
}

export interface AttendanceReportData {
  scope: 'month' | 'year'
  year: number
  month: number | null
  periodLabel: string
  totals: BookingTotals
  classSessions: ClassSession[]
  yearSummary: YearMonthSummary[]
  yearTotals: BookingTotals
}

// Fetch functions
async function fetchReportsOverview(params: ReportsOverviewParams): Promise<ReportsOverviewData> {
  const query = new URLSearchParams({ year: String(params.year) })
  if (params.month) query.set('month', String(params.month))
  const response = await fetch(`/api/reports?${query.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch reports overview')
  }
  const json = await response.json()
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch reports')
  }
  return json.data
}

async function fetchMarketingReport(params: MarketingReportParams): Promise<MarketingReportData> {
  const query = new URLSearchParams({ year: String(params.year) })
  if (params.month) query.set('month', String(params.month))
  const response = await fetch(`/api/reports/marketing?${query.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch marketing report')
  }
  const json = await response.json()
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch marketing report')
  }
  return json.data
}

async function fetchRevenueReport(params: RevenueReportParams): Promise<RevenueReportData> {
  const query = new URLSearchParams({ year: String(params.year) })
  if (params.month) query.set('month', String(params.month))
  const response = await fetch(`/api/reports/revenue?${query.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch revenue report')
  }
  const json = await response.json()
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch revenue report')
  }
  return json.data
}

async function fetchAttendanceReport(params: AttendanceReportParams): Promise<AttendanceReportData> {
  const query = new URLSearchParams({ year: String(params.year), scope: params.scope })
  if (params.scope === 'month') {
    query.set('month', String(params.month))
  }
  const response = await fetch(`/api/reports/attendance?${query.toString()}`)
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

// Hooks
export function useReportsOverview(params: ReportsOverviewParams) {
  return useQuery({
    queryKey: ['reports', 'overview', params.year, params.month ?? 'all'],
    queryFn: () => fetchReportsOverview(params),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

export function useRevenueReport(params: RevenueReportParams) {
  return useQuery({
    queryKey: ['reports', 'revenue', params.year, params.month ?? 'all'],
    queryFn: () => fetchRevenueReport(params),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

export function useMarketingReport(params: MarketingReportParams) {
  return useQuery({
    queryKey: ['reports', 'marketing', params.year, params.month ?? 'all'],
    queryFn: () => fetchMarketingReport(params),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

export function useAttendanceReport(params: AttendanceReportParams) {
  return useQuery({
    queryKey: ['reports', 'attendance', params.scope, params.year, params.month],
    queryFn: () => fetchAttendanceReport(params),
    staleTime: 0,
    refetchOnMount: 'always',
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
  })
}
