import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type IssueType = 'no-show' | 'late-cancel' | 'early-cancel' | 'expired'
export type IssueStatus = 'pending' | 'excused' | 'penalized' | 'resolved'

export interface AttendanceIssue {
  id: string
  bookingId: string
  userId: string
  userName: string
  userEmail: string
  userPhone: string
  classId: string
  className: string
  classDate: string
  classTime: string
  instructor: string
  issueType: IssueType
  status: IssueStatus
  tokenRefunded: boolean
  penaltyApplied: boolean
  notes: string
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
  noShowCount: number
}

export interface AttendanceIssuesStats {
  pending: number
  noShows: number
  lateCancels: number
  earlyCancels: number
  expired: number
  todayCount: number
}

export interface AttendanceIssuesResponse {
  issues: AttendanceIssue[]
  stats: AttendanceIssuesStats
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ResolveIssueParams {
  bookingId: string
  action: 'excuse' | 'penalize' | 'resolve'
  notes?: string
  resolvedBy: string
}

export interface ResolveIssueResult {
  success: boolean
  message: string
  issue: {
    bookingId: string
    status: IssueStatus
    tokenRefunded: boolean
    penaltyApplied: boolean
    resolvedAt: string
    resolvedBy: string
  }
}

interface UseAttendanceIssuesParams {
  type?: IssueType | 'all'
  status?: IssueStatus | 'all'
  dateRange?: 'today' | 'week' | 'month' | 'all'
  search?: string
  page?: number
  limit?: number
}

// Fetch attendance issues
async function fetchAttendanceIssues(params: UseAttendanceIssuesParams): Promise<AttendanceIssuesResponse> {
  const searchParams = new URLSearchParams()
  
  if (params.type && params.type !== 'all') searchParams.set('type', params.type)
  if (params.status && params.status !== 'all') searchParams.set('status', params.status)
  if (params.dateRange && params.dateRange !== 'all') searchParams.set('dateRange', params.dateRange)
  if (params.search) searchParams.set('search', params.search)
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())

  const response = await fetch(`/api/attendance/issues?${searchParams.toString()}`)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch attendance issues')
  }
  
  return response.json()
}

// Resolve an issue
async function resolveIssue(params: ResolveIssueParams): Promise<ResolveIssueResult> {
  const response = await fetch('/api/attendance/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to resolve issue')
  }
  
  return response.json()
}

// Hook to fetch attendance issues
export function useAttendanceIssues(params: UseAttendanceIssuesParams = {}) {
  return useQuery({
    queryKey: ['attendanceIssues', params],
    queryFn: () => fetchAttendanceIssues(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}

// Hook to resolve (excuse/penalize/resolve) an issue
export function useResolveIssue() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: resolveIssue,
    onSuccess: () => {
      // Invalidate attendance issues query to refetch
      queryClient.invalidateQueries({ queryKey: ['attendanceIssues'] })
    },
  })
}

// Hook to excuse an issue (refund token)
export function useExcuseIssue() {
  const resolveIssue = useResolveIssue()
  
  return {
    ...resolveIssue,
    mutate: (params: Omit<ResolveIssueParams, 'action'>) => {
      resolveIssue.mutate({ ...params, action: 'excuse' })
    },
    mutateAsync: (params: Omit<ResolveIssueParams, 'action'>) => {
      return resolveIssue.mutateAsync({ ...params, action: 'excuse' })
    },
  }
}

// Hook to penalize an issue
export function usePenalizeIssue() {
  const resolveIssue = useResolveIssue()
  
  return {
    ...resolveIssue,
    mutate: (params: Omit<ResolveIssueParams, 'action'>) => {
      resolveIssue.mutate({ ...params, action: 'penalize' })
    },
    mutateAsync: (params: Omit<ResolveIssueParams, 'action'>) => {
      return resolveIssue.mutateAsync({ ...params, action: 'penalize' })
    },
  }
}

// Hook to resolve without action
export function useResolveWithoutAction() {
  const resolveIssue = useResolveIssue()
  
  return {
    ...resolveIssue,
    mutate: (params: Omit<ResolveIssueParams, 'action'>) => {
      resolveIssue.mutate({ ...params, action: 'resolve' })
    },
    mutateAsync: (params: Omit<ResolveIssueParams, 'action'>) => {
      return resolveIssue.mutateAsync({ ...params, action: 'resolve' })
    },
  }
}
