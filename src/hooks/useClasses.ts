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
  ageGroup?: 'adult' | 'kid' | 'all' // Target audience: adult (13+), kid (<13), or all (both)
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
  ageGroup?: 'adult' | 'kid' | 'all' // Target audience: adult (13+), kid (<13), or all (both)
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
  const response = await api.get<{ class: ClassWithAvailability }>(`/api/classes/${id}`)

  if (response.error) {
    console.error('[fetchClass] API error:', response.error)
    throw new Error(response.error.message || 'Failed to fetch class')
  }

  if (!response.data) {
    console.error('[fetchClass] No data in response')
    throw new Error('No class data returned from API')
  }

  // Handle various response structures from API
  const data = response.data as any
  
  // Try different possible response structures:
  // 1. Direct class object: response.data.class
  // 2. Nested class object: response.data.data.class
  // 3. Class data directly in response.data (no .class property)
  const classData = data.class || data.data?.class || data.data || data
  
  // Validate we got actual class data (should have an id)
  if (!classData || !classData.id) {
    console.error('[fetchClass] Invalid class data in response:', response.data)
    throw new Error('Invalid API response structure - missing class data')
  }

  return classData
}

async function fetchInstructors(): Promise<Instructor[]> {
  const response = await api.get<{ instructors: Instructor[]; total: number }>('/api/instructors')

  console.log('[fetchInstructors] Full response:', response)
  console.log('[fetchInstructors] response.data:', response.data)
  console.log('[fetchInstructors] response.data.data:', (response.data as any)?.data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch instructors')
  }

  // The API wraps responses: response.data = {success: true, data: {instructors: [], total: N}}
  const data = response.data as any
  const actualData = data?.data || data
  const instructors = actualData?.instructors || []
  
  console.log('[fetchInstructors] Extracted instructors array:', instructors)
  return instructors
}

async function fetchRooms(): Promise<Room[]> {
  const response = await api.get<{ rooms: Room[]; stats: any; total: number }>('/api/rooms')

  console.log('[fetchRooms] Full response:', response)
  console.log('[fetchRooms] response.data:', response.data)
  console.log('[fetchRooms] response.data.data:', (response.data as any)?.data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch rooms')
  }

  // The API wraps responses: response.data = {success: true, data: {rooms: [], total: N}}
  const data = response.data as any
  const actualData = data?.data || data
  const rooms = actualData?.rooms || []
  
  console.log('[fetchRooms] Extracted rooms array:', rooms)
  return rooms
}

async function fetchCategories(): Promise<ClassCategory[]> {
  const response = await api.get<{ categories: ClassCategory[]; total: number }>('/api/class-categories')

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch categories')
  }

  return response.data?.categories || []
}

async function createClass(data: CreateClassData): Promise<ClassWithAvailability> {
  const response = await api.post<{ class: ClassWithAvailability }>('/api/classes', data)

  if (response.error) {
    console.error('[createClass] API error:', response.error)
    throw new Error(response.error.message || 'Failed to create class')
  }

  if (!response.data) {
    console.error('[createClass] No data in response')
    throw new Error('No class data returned from API')
  }

  const classData = response.data.class
  if (!classData) {
    console.error('[createClass] No class property in response data:', response.data)
    throw new Error('Invalid API response structure - missing class property')
  }

  return classData
}

async function updateClass(id: string, data: Partial<CreateClassData>): Promise<ClassWithAvailability> {
  const response = await api.put<{ class: ClassWithAvailability }>(`/api/classes/${id}`, data)

  if (response.error) {
    console.error('[updateClass] API error:', response.error)
    throw new Error(response.error.message || 'Failed to update class')
  }

  if (!response.data) {
    console.error('[updateClass] No data in response')
    throw new Error('No class data returned from API')
  }

  const classData = response.data.class
  if (!classData) {
    console.error('[updateClass] No class property in response data:', response.data)
    throw new Error('Invalid API response structure - missing class property')
  }

  return classData
}

async function cancelClass(id: string): Promise<{ success: boolean; message: string; refundedBookings: number }> {
  const response = await api.delete<{ success: boolean; message: string; refundedBookings: number }>(
    `/api/classes/${id}`
  )

  if (response.error) {
    throw new Error(response.error.message || 'Failed to cancel class')
  }

  return response.data || { success: false, message: 'Unknown error', refundedBookings: 0 }
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
    retry: 1,
    throwOnError: false, // Don't throw errors to component; handle gracefully
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
