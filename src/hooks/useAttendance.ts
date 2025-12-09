import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// =====================================================
// Types
// =====================================================

export interface Attendee {
  id: string
  name: string
  email: string
  phone: string | null
  bookingId: string
  status: 'pending' | 'checked-in' | 'no-show'
  checkedInAt: string | null
  tokenBalance: number
  tokensUsed: number
}

export interface ClassSession {
  id: string
  className: string
  instructor: string
  instructorId: string | null
  time: string
  endTime: string
  capacity: number
  room: string
  roomId: string | null
  status: string
  attendees: Attendee[]
}

export interface AttendanceStats {
  totalClasses: number
  totalBookings: number
  checkedIn: number
  pending: number
  noShows: number
}

export interface AttendanceData {
  date: string
  classes: ClassSession[]
  stats: AttendanceStats
}

export interface CheckInResult {
  attendance: {
    id: string
    bookingId: string
    checkedInAt: string
    checkedInBy: string
    checkInMethod: string
    notes: string | null
    createdAt: string
  }
  tokensConsumed: number
  tokensRemaining: number
  message: string
}

export interface BulkCheckInResult {
  successful: { bookingId: string; attendanceId: string; userName: string }[]
  failed: { bookingId: string; error: string }[]
  summary: {
    totalProcessed: number
    totalSuccessful: number
    totalFailed: number
  }
}

export interface NoShowResult {
  bookingId: string
  tokensConsumed: number
  userNoShowCount: number
  userFlagged: boolean
  message: string
}

// =====================================================
// Query Keys
// =====================================================

export const attendanceKeys = {
  all: ['attendance'] as const,
  daily: (date: string) => [...attendanceKeys.all, 'daily', date] as const,
}

// =====================================================
// API Functions
// =====================================================

async function fetchTodayAttendance(date?: string): Promise<AttendanceData> {
  const params = new URLSearchParams()
  if (date) {
    params.append('date', date)
  }

  const response = await api.get<{ 
    data: AttendanceData 
  }>(`/api/attendance?${params.toString()}`)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch attendance data')
  }

  return response.data?.data as AttendanceData
}

async function checkInBooking(params: {
  bookingId: string
  checkedInBy: string
  method?: 'manual' | 'qr-code' | 'auto' | 'admin'
  notes?: string
}): Promise<CheckInResult> {
  const response = await api.post<{ data: CheckInResult }>('/api/attendance/check-in', {
    bookingId: params.bookingId,
    checkedInBy: params.checkedInBy,
    method: params.method || 'admin',
    notes: params.notes,
  })

  if (response.error) {
    throw new Error(response.error.message || 'Failed to check in')
  }

  return response.data?.data as CheckInResult
}

async function bulkCheckInBookings(params: {
  bookingIds: string[]
  checkedInBy: string
  notes?: string
}): Promise<BulkCheckInResult> {
  const response = await api.post<{ data: BulkCheckInResult }>('/api/attendance/check-in', {
    bookingIds: params.bookingIds,
    checkedInBy: params.checkedInBy,
    notes: params.notes,
  })

  if (response.error) {
    throw new Error(response.error.message || 'Failed to bulk check in')
  }

  return response.data?.data as BulkCheckInResult
}

async function markNoShow(params: {
  bookingId: string
  markedBy: string
  notes?: string
}): Promise<NoShowResult> {
  const response = await api.post<{ data: NoShowResult }>('/api/attendance/no-show', {
    bookingId: params.bookingId,
    markedBy: params.markedBy,
    notes: params.notes,
  })

  if (response.error) {
    throw new Error(response.error.message || 'Failed to mark as no-show')
  }

  return response.data?.data as NoShowResult
}

// =====================================================
// Hooks
// =====================================================

// Fetch today's attendance data
export function useAttendance(date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0]
  
  return useQuery({
    queryKey: attendanceKeys.daily(targetDate),
    queryFn: () => fetchTodayAttendance(targetDate),
    staleTime: 0, // Always fresh for real-time check-in
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  })
}

// Check in a single booking
export function useCheckIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: checkInBooking,
    onSuccess: () => {
      // Invalidate attendance data to refresh
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.all,
        refetchType: 'active',
      })
    },
  })
}

// Bulk check in bookings
export function useBulkCheckIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkCheckInBookings,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.all,
        refetchType: 'active',
      })
    },
  })
}

// Mark booking as no-show
export function useMarkNoShow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNoShow,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attendanceKeys.all,
        refetchType: 'active',
      })
    },
  })
}

// Invalidate attendance cache
export function useInvalidateAttendance() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => queryClient.invalidateQueries({
      queryKey: attendanceKeys.all,
      refetchType: 'active',
    }),
  }
}
