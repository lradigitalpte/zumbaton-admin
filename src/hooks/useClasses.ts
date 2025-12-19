import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// =====================================================
// Types
// =====================================================

export interface Instructor {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
}

export interface Room {
  id: string
  name: string
  description?: string | null
  capacity: number
  location?: string | null
  amenities: string[]
  isActive: boolean
  sortOrder: number
}

export interface ClassCategory {
  id: string
  name: string
  slug: string
  description?: string | null
  color?: string | null
  icon?: string | null
  parentId?: string | null
  isActive: boolean
  sortOrder: number
}

export interface ClassWithAvailability {
  id: string
  title: string
  description?: string | null
  classType: string
  level: string
  instructorId?: string | null
  instructorName?: string | null
  scheduledAt: string
  durationMinutes: number
  capacity: number
  tokenCost: number
  location?: string | null
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  roomId?: string | null
  categoryId?: string | null
  recurrenceType?: 'single' | 'recurring' | 'course'
  recurrencePattern?: Record<string, unknown> | null
  bookedCount: number
  spotsRemaining: number
  waitlistCount: number
  isBookable: boolean
  allowDropIn?: boolean
  dropInTokenCost?: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateClassData {
  title: string
  description?: string
  classType: string
  level?: string
  instructorId?: string
  instructorIds?: string[] // Multiple instructor IDs
  scheduledAt: string
  durationMinutes?: number
  capacity: number
  tokenCost?: number
  location?: string
  roomId?: string
  categoryId?: string
  recurrenceType?: 'single' | 'recurring' | 'course'
  recurrencePattern?: {
    days?: string[]
    endDate?: string
    endType?: 'never' | 'date' | 'count'
    occurrences?: number
  }
  // Walk-in/drop-in settings
  allowDropIn?: boolean
  dropInTokenCost?: number
}

export interface ClassListQuery {
  page?: number
  pageSize?: number
  classType?: string
  level?: string
  status?: string
  instructorId?: string
  startDate?: string
  endDate?: string
}

// =====================================================
// Query Keys
// =====================================================

export const classKeys = {
  all: ['classes'] as const,
  lists: () => [...classKeys.all, 'list'] as const,
  list: (filters: ClassListQuery) => [...classKeys.lists(), filters] as const,
  details: () => [...classKeys.all, 'detail'] as const,
  detail: (id: string) => [...classKeys.details(), id] as const,
}

export const instructorKeys = {
  all: ['instructors'] as const,
  list: () => [...instructorKeys.all, 'list'] as const,
}

export const roomKeys = {
  all: ['rooms'] as const,
  list: () => [...roomKeys.all, 'list'] as const,
}

export const categoryKeys = {
  all: ['class-categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
}

// =====================================================
// Fetch Functions
// =====================================================

async function fetchClasses(query: ClassListQuery): Promise<{
  classes: ClassWithAvailability[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}> {
  const params = new URLSearchParams()
  
  if (query.page) params.append('page', query.page.toString())
  if (query.pageSize) params.append('pageSize', query.pageSize.toString())
  if (query.classType) params.append('classType', query.classType)
  if (query.level) params.append('level', query.level)
  if (query.status) params.append('status', query.status)
  if (query.instructorId) params.append('instructorId', query.instructorId)
  if (query.startDate) params.append('startDate', query.startDate)
  if (query.endDate) params.append('endDate', query.endDate)

  const response = await api.get<{ data: { classes: ClassWithAvailability[]; total: number; page: number; pageSize: number; hasMore: boolean } }>(
    `/api/classes?${params.toString()}`
  )

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch classes')
  }

  return response.data?.data || { classes: [], total: 0, page: 1, pageSize: 20, hasMore: false }
}

async function fetchClass(id: string): Promise<ClassWithAvailability> {
  const response = await api.get<{ data: { class: ClassWithAvailability } }>(`/api/classes/${id}`)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch class')
  }

  return response.data?.data?.class as ClassWithAvailability
}

async function fetchInstructors(): Promise<Instructor[]> {
  const response = await api.get<{ data: { instructors: Instructor[] } }>('/api/instructors')

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch instructors')
  }

  return response.data?.data?.instructors || []
}

async function fetchRooms(): Promise<Room[]> {
  const response = await api.get<{ data: { rooms: Room[] } }>('/api/rooms')

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch rooms')
  }

  return response.data?.data?.rooms || []
}

async function fetchCategories(): Promise<ClassCategory[]> {
  const response = await api.get<{ data: { categories: ClassCategory[] } }>('/api/class-categories')

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch categories')
  }

  return response.data?.data?.categories || []
}

async function createClass(data: CreateClassData): Promise<ClassWithAvailability> {
  const response = await api.post<{ data: { class: ClassWithAvailability } }>('/api/classes', data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to create class')
  }

  return response.data?.data?.class as ClassWithAvailability
}

async function updateClass(id: string, data: Partial<CreateClassData>): Promise<ClassWithAvailability> {
  const response = await api.put<{ data: { class: ClassWithAvailability } }>(`/api/classes/${id}`, data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to update class')
  }

  return response.data?.data?.class as ClassWithAvailability
}

async function cancelClass(id: string): Promise<{ success: boolean; message: string; refundedBookings: number }> {
  const response = await api.delete<{ data: { success: boolean; message: string; refundedBookings: number } }>(
    `/api/classes/${id}`
  )

  if (response.error) {
    throw new Error(response.error.message || 'Failed to cancel class')
  }

  return response.data?.data || { success: false, message: 'Unknown error', refundedBookings: 0 }
}

// =====================================================
// Hooks
// =====================================================

// Fetch list of classes
export function useClasses(query: ClassListQuery = {}) {
  return useQuery({
    queryKey: classKeys.list(query),
    queryFn: () => fetchClasses(query),
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  })
}

// Fetch single class
export function useClass(id: string) {
  return useQuery({
    queryKey: classKeys.detail(id),
    queryFn: () => fetchClass(id),
    enabled: !!id,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  })
}

// Fetch instructors
export function useInstructors() {
  return useQuery({
    queryKey: instructorKeys.list(),
    queryFn: fetchInstructors,
    // Uses global 30-minute staleTime - instructors don't change often
  })
}

// Fetch rooms
export function useRooms() {
  return useQuery({
    queryKey: roomKeys.list(),
    queryFn: fetchRooms,
    // Uses global 30-minute staleTime
  })
}

// Fetch categories
export function useClassCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: fetchCategories,
    // Uses global 30-minute staleTime
  })
}

// Create class mutation
export function useCreateClass() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createClass,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: classKeys.all,
        refetchType: 'active',
      })
    },
  })
}

// Update class mutation
export function useUpdateClass() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateClassData> }) => updateClass(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: classKeys.detail(variables.id),
        refetchType: 'active',
      })
      queryClient.invalidateQueries({
        queryKey: classKeys.lists(),
        refetchType: 'active',
      })
    },
  })
}

// Cancel class mutation
export function useCancelClass() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cancelClass,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: classKeys.detail(id),
        refetchType: 'active',
      })
      queryClient.invalidateQueries({
        queryKey: classKeys.lists(),
        refetchType: 'active',
      })
    },
  })
}

// Invalidate classes cache
export function useInvalidateClasses() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => queryClient.invalidateQueries({
      queryKey: classKeys.all,
      refetchType: 'active',
    }),
    invalidateList: (filters?: ClassListQuery) => {
      if (filters) {
        queryClient.invalidateQueries({
          queryKey: classKeys.list(filters),
          refetchType: 'active',
        })
      } else {
        queryClient.invalidateQueries({
          queryKey: classKeys.lists(),
          refetchType: 'active',
        })
      }
    },
    invalidateDetail: (id: string) => queryClient.invalidateQueries({
      queryKey: classKeys.detail(id),
      refetchType: 'active',
    }),
  }
}
