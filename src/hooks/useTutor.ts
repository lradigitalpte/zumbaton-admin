import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// =====================================================
// TYPES
// =====================================================

export interface TutorDashboardData {
  profile: {
    id: string
    name: string
    email: string
    avatar_url: string | null
  } | null
  stats: {
    thisWeekClasses: number
    totalStudents: number
    attendanceRate: number
    upcomingClasses: number
    totalClassesTaught: number
  }
  nextClassIn: {
    hours: number
    mins: number
    total: number
  } | null
  todayClasses: Array<{
    id: string
    title: string
    class_type: string
    scheduled_at: string
    duration_minutes: number
    capacity: number
    location: string | null
    room_name?: string | null
    status: string
    bookedCount: number
    checkedInCount: number
  }>
  weekSchedule: Array<{
    id: string
    title: string
    class_type: string
    scheduled_at: string
    duration_minutes: number
    capacity: number
    location: string | null
    status: string
  }>
  specialties: string[]
}

export interface TutorClass {
  id: string
  title: string
  description: string | null
  class_type: string
  level: string
  scheduled_at: string
  duration_minutes: number
  capacity: number
  token_cost: number
  location: string | null
  room_name?: string | null
  status: string
  created_at: string
  bookedCount: number
  attendedCount: number
  _isParent?: boolean
  _childInstances?: TutorClass[]
  _totalSessions?: number
  recurrence_type?: string | null
  parent_class_id?: string | null
}

export interface TutorStudent {
  id: string
  name: string
  email: string
  avatar_url: string | null
  phone: string | null
  created_at: string
  stats: {
    classesBooked: number
    classesAttended: number
    noShows: number
  }
  attendanceRate: number
}

export interface TutorSchedule {
  schedule: Record<string, Array<{
    id: string
    title: string
    classType: string
    time: string
    duration: number
    location: string | null
    status: string
    booked: number
    capacity: number
  }>>
  period: {
    start: string
    end: string
    view: string
  }
  summary: {
    totalClasses: number
    byType: Record<string, number>
  }
}

export interface TutorStats {
  overview: {
    totalClassesTaught: number
    totalScheduled: number
    uniqueStudents: number
    totalStudentBookings: number
    attendanceRate: number
    noShowRate: number
    avgClassSize: number
    capacityUtilization: number
  }
  thisMonth: {
    classes: number
    students: number
    attendance: number
    attendanceRate: number
  }
  changes: {
    classesChange: number
    studentsChange: number
    attendanceRateChange: number
  }
  byClassType: Record<string, number>
}

export interface TimeSlot {
  start: string
  end: string
}

export interface DayAvailability {
  enabled: boolean
  slots: TimeSlot[]
}

export interface WeeklyAvailability {
  [day: string]: DayAvailability
}

export interface TimeOffRequest {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  createdAt: string
}

export interface TutorAvailability {
  availability: WeeklyAvailability
  timeOffRequests: TimeOffRequest[]
  stats: {
    hoursPerWeek: number
    daysAvailable: number
    pendingRequests: number
    approvedTimeOff: number
  }
}

export interface TutorProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  avatarUrl: string | null
  createdAt: string
  bio?: string
  specialties?: string[]
  certifications?: string[]
  yearsExperience?: number
  hourlyRate?: number
  rating?: number
  totalReviews?: number
}

export interface TutorProfileData {
  profile: TutorProfile
  sessions: Array<{
    id: string
    device: string
    browser: string
    location: string
    ip: string
    lastActive: string
    current: boolean
  }>
  security: {
    twoFactorEnabled: boolean
    lastPasswordChange: string | null
  }
}

export interface TutorSettings {
  theme: 'light' | 'dark' | 'system'
  language: string
  timezone: string
  dateFormat: string
  timeFormat: '12h' | '24h'
  calendarStartDay: 0 | 1 | 6
  showWeekNumbers: boolean
  defaultClassDuration: number
  reminderMinutesBefore: number
  autoCheckIn: boolean
}

export interface TutorSettingsData {
  settings: TutorSettings
  options: {
    themes: Array<{ value: string; label: string }>
    languages: Array<{ value: string; label: string }>
    timezones: Array<{ value: string; label: string }>
    dateFormats: Array<{ value: string; label: string }>
    timeFormats: Array<{ value: string; label: string }>
    calendarStartDays: Array<{ value: number; label: string }>
  }
}

export interface NotificationChannel {
  email: boolean
  push: boolean
  sms: boolean
}

export interface NotificationPreferences {
  classReminders: NotificationChannel
  studentBookings: NotificationChannel
  cancellations: NotificationChannel
  scheduleChanges: NotificationChannel
  weeklyReport: NotificationChannel
  paymentUpdates: NotificationChannel
  systemAlerts: NotificationChannel
  marketing: NotificationChannel
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
  data?: Record<string, unknown>
}

export interface TutorNotificationsData {
  preferences: NotificationPreferences
  notifications: Notification[]
  unreadCount: number
  categories: Array<{
    id: string
    title: string
    description: string
  }>
}

// =====================================================
// API FUNCTIONS
// =====================================================

async function fetchTutorDashboard(): Promise<TutorDashboardData> {
  const response = await api.get<{ success: boolean; data: TutorDashboardData; error?: { message: string } }>('/api/tutor/dashboard')
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch tutor dashboard')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to fetch tutor dashboard')
  }
  return json.data
}

async function fetchTutorClasses(params?: {
  status?: 'upcoming' | 'past' | 'today' | 'all'
  limit?: number
  offset?: number
}): Promise<{ classes: TutorClass[]; meta: { total: number; hasMore: boolean } }> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.offset) searchParams.set('offset', params.offset.toString())
  
  const url = `/api/tutor/classes${searchParams.toString() ? `?${searchParams}` : ''}`
  const response = await api.get<{ success: boolean; data: { classes: TutorClass[]; meta: { total: number; hasMore: boolean } }; error?: { message: string } }>(url)
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch tutor classes')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to fetch tutor classes')
  }
  return json.data
}

async function fetchTutorClassDetail(classId: string): Promise<{
  class: TutorClass
  students: Array<{
    bookingId: string
    status: string
    bookedAt: string
    user: {
      id: string
      name: string
      email: string
      avatar_url: string | null
      phone: string | null
    }
  }>
  stats: {
    enrolled: number
    confirmed: number
    attended: number
    noShow: number
    spotsLeft: number
  }
}> {
  type ClassDetailResponse = {
    class: TutorClass
    students: Array<{
      bookingId: string
      status: string
      bookedAt: string
      user: {
        id: string
        name: string
        email: string
        avatar_url: string | null
        phone: string | null
      }
    }>
    stats: {
      enrolled: number
      confirmed: number
      attended: number
      noShow: number
      spotsLeft: number
    }
  }
  const response = await api.get<{ success: boolean; data: ClassDetailResponse; error?: { message: string } }>(`/api/tutor/classes/${classId}`)
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch class detail')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to fetch class detail')
  }
  return json.data
}

async function fetchTutorStudents(params?: {
  search?: string
  limit?: number
  offset?: number
}): Promise<{ students: TutorStudent[]; meta: { total: number; hasMore: boolean } }> {
  const searchParams = new URLSearchParams()
  if (params?.search) searchParams.set('search', params.search)
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.offset) searchParams.set('offset', params.offset.toString())
  
  const url = `/api/tutor/students${searchParams.toString() ? `?${searchParams}` : ''}`
  const response = await api.get<{ success: boolean; data: { students: TutorStudent[]; meta: { total: number; hasMore: boolean } }; error?: { message: string } }>(url)
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch tutor students')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to fetch tutor students')
  }
  return json.data
}

async function fetchTutorSchedule(params?: {
  view?: 'week' | 'month'
  date?: string
}): Promise<TutorSchedule> {
  const searchParams = new URLSearchParams()
  if (params?.view) searchParams.set('view', params.view)
  if (params?.date) searchParams.set('date', params.date)
  
  const url = `/api/tutor/schedule${searchParams.toString() ? `?${searchParams}` : ''}`
  const response = await api.get<{ success: boolean; data: TutorSchedule; error?: { message: string } }>(url)
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch tutor schedule')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to fetch tutor schedule')
  }
  return json.data
}

async function fetchTutorStats(): Promise<TutorStats> {
  const response = await api.get<{ success: boolean; data: TutorStats; error?: { message: string } }>('/api/tutor/stats')
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch tutor stats')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to fetch tutor stats')
  }
  return json.data
}

async function fetchTutorAvailability(): Promise<TutorAvailability> {
  const response = await api.get<{ success: boolean; data: TutorAvailability; error?: { message: string } }>('/api/tutor/availability')
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch availability')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to fetch availability')
  }
  return json.data
}

async function updateTutorAvailability(availability: WeeklyAvailability): Promise<{ message: string }> {
  const response = await api.put<{ success: boolean; data: { message: string }; error?: { message: string } }>('/api/tutor/availability', { availability })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to update availability')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to update availability')
  }
  return json.data
}

async function requestTimeOff(data: { startDate: string; endDate: string; reason: string }): Promise<TimeOffRequest> {
  const response = await api.post<{ success: boolean; data: TimeOffRequest; error?: { message: string } }>('/api/tutor/availability', {
    action: 'request_time_off',
    ...data
  })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to request time off')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to request time off')
  }
  return json.data
}

async function cancelTimeOff(requestId: string): Promise<{ message: string }> {
  const response = await api.post<{ success: boolean; data: { message: string }; error?: { message: string } }>('/api/tutor/availability', {
    action: 'cancel_time_off',
    requestId
  })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to cancel time off')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to cancel time off')
  }
  return json.data
}

async function fetchTutorProfile(): Promise<TutorProfileData> {
  const response = await api.get<{ success: boolean; data: TutorProfileData; error?: { message: string } }>('/api/tutor/profile')
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch profile')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to fetch profile')
  }
  return json.data
}

async function updateTutorProfile(data: Partial<TutorProfile>): Promise<{ message: string }> {
  const response = await api.put<{ success: boolean; data: { message: string }; error?: { message: string } }>('/api/tutor/profile', data)
  if (response.error) {
    throw new Error(response.error.message || 'Failed to update profile')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to update profile')
  }
  return json.data
}

async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const response = await api.post<{ success: boolean; data: { message: string }; error?: { message: string } }>('/api/tutor/profile', {
    action: 'change_password',
    currentPassword,
    newPassword
  })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to change password')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to change password')
  }
  return json.data
}

async function fetchTutorSettings(): Promise<TutorSettingsData> {
  const response = await api.get<{ success: boolean; data: TutorSettingsData; error?: { message: string } }>('/api/tutor/settings')
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch settings')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to fetch settings')
  }
  return json.data
}

async function updateTutorSettings(settings: Partial<TutorSettings>): Promise<{ message: string }> {
  const response = await api.put<{ success: boolean; data: { message: string }; error?: { message: string } }>('/api/tutor/settings', { settings })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to update settings')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to update settings')
  }
  return json.data
}

async function fetchTutorNotifications(): Promise<TutorNotificationsData> {
  const response = await api.get<{ success: boolean; data: TutorNotificationsData; error?: { message: string } }>('/api/tutor/notifications')
  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch notifications')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to fetch notifications')
  }
  return json.data
}

async function updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<{ message: string }> {
  const response = await api.put<{ success: boolean; data: { message: string }; error?: { message: string } }>('/api/tutor/notifications', { preferences })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to update preferences')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to update preferences')
  }
  return json.data
}

async function markNotificationsRead(notificationIds?: string[]): Promise<{ message: string }> {
  const response = await api.post<{ success: boolean; data: { message: string }; error?: { message: string } }>('/api/tutor/notifications', {
    action: 'mark_read',
    notificationIds
  })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to mark notifications as read')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to mark notifications as read')
  }
  return json.data
}

async function clearAllNotifications(): Promise<{ message: string }> {
  const response = await api.post<{ success: boolean; data: { message: string }; error?: { message: string } }>('/api/tutor/notifications', {
    action: 'clear_all'
  })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to clear notifications')
  }
  const json = response.data
  if (!json?.success) {
    throw new Error(json?.error?.message || 'Failed to clear notifications')
  }
  return json.data
}

// =====================================================
// HOOKS
// =====================================================

/**
 * Hook for tutor dashboard data
 */
export function useTutorDashboard() {
  return useQuery({
    queryKey: ['tutor', 'dashboard'],
    queryFn: fetchTutorDashboard,
    staleTime: 2 * 60 * 1000, // 2 minutes - dashboard should be fresh
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

/**
 * Hook for tutor's classes
 */
export function useTutorClasses(params?: {
  status?: 'upcoming' | 'past' | 'today' | 'all'
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: ['tutor', 'classes', params],
    queryFn: () => fetchTutorClasses(params),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook for specific class detail with enrolled students
 */
export function useTutorClassDetail(classId: string) {
  return useQuery({
    queryKey: ['tutor', 'class', classId],
    queryFn: () => fetchTutorClassDetail(classId),
    staleTime: 2 * 60 * 1000,
    enabled: !!classId,
  })
}

/**
 * Hook for tutor's students
 */
export function useTutorStudents(params?: {
  search?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: ['tutor', 'students', params],
    queryFn: () => fetchTutorStudents(params),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook for tutor's schedule
 */
export function useTutorSchedule(params?: {
  view?: 'week' | 'month'
  date?: string
}) {
  return useQuery({
    queryKey: ['tutor', 'schedule', params],
    queryFn: () => fetchTutorSchedule(params),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook for tutor's statistics
 */
export function useTutorStats() {
  return useQuery({
    queryKey: ['tutor', 'stats'],
    queryFn: fetchTutorStats,
    staleTime: 10 * 60 * 1000, // 10 minutes - stats don't change often
  })
}

/**
 * Hook for tutor's availability
 */
export function useTutorAvailability() {
  return useQuery({
    queryKey: ['tutor', 'availability'],
    queryFn: fetchTutorAvailability,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook for tutor's profile
 */
export function useTutorProfile() {
  return useQuery({
    queryKey: ['tutor', 'profile'],
    queryFn: fetchTutorProfile,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook for tutor's settings
 */
export function useTutorSettings() {
  return useQuery({
    queryKey: ['tutor', 'settings'],
    queryFn: fetchTutorSettings,
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * Hook for tutor's notifications
 */
export function useTutorNotifications() {
  return useQuery({
    queryKey: ['tutor', 'notifications'],
    queryFn: fetchTutorNotifications,
    staleTime: 1 * 60 * 1000, // 1 minute - notifications should be fresh
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  })
}

// Export mutation functions for use with useMutation
export { 
  updateTutorAvailability, 
  requestTimeOff, 
  cancelTimeOff,
  updateTutorProfile,
  changePassword,
  updateTutorSettings,
  updateNotificationPreferences,
  markNotificationsRead,
  clearAllNotifications
}
