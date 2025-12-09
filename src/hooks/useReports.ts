/**
 * Reports Hooks
 * React Query hooks for fetching report data
 */

import { useQuery } from '@tanstack/react-query'

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

// Hooks
export function useReportsOverview(range: DateRange = 'month') {
  return useQuery({
    queryKey: ['reports', 'overview', range],
    queryFn: () => fetchReportsOverview(range),
    // Uses global 30-minute staleTime from react-query.tsx
  })
}

export function useRevenueReport(range: DateRange = 'month') {
  return useQuery({
    queryKey: ['reports', 'revenue', range],
    queryFn: () => fetchRevenueReport(range),
    // Uses global 30-minute staleTime from react-query.tsx
  })
}

export function useAttendanceReport(range: DateRange = 'month') {
  return useQuery({
    queryKey: ['reports', 'attendance', range],
    queryFn: () => fetchAttendanceReport(range),
    // Uses global 30-minute staleTime from react-query.tsx
  })
}
