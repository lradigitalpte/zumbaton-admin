import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// =====================================================
// Types
// =====================================================

export type RoomType = 'studio' | 'outdoor' | 'pool' | 'gym' | 'other'
export type RoomStatus = 'available' | 'maintenance' | 'inactive'

export interface Room {
  id: string
  name: string
  description?: string | null
  capacity: number
  location?: string | null
  type: RoomType
  amenities: string[]
  status: RoomStatus
  color: string
  isActive: boolean
  sortOrder: number
}

export interface RoomStats {
  total: number
  available: number
  maintenance: number
  totalCapacity: number
}

export interface CreateRoomData {
  name: string
  description?: string
  capacity?: number
  location?: string
  type?: RoomType
  amenities?: string[]
  status?: RoomStatus
  color?: string
}

export interface UpdateRoomData extends Partial<CreateRoomData> {}

// =====================================================
// Query Keys
// =====================================================

export const roomKeys = {
  all: ['rooms'] as const,
  lists: () => [...roomKeys.all, 'list'] as const,
  list: (filters?: { type?: string }) => [...roomKeys.lists(), filters] as const,
  details: () => [...roomKeys.all, 'detail'] as const,
  detail: (id: string) => [...roomKeys.details(), id] as const,
}

// =====================================================
// API Functions
// =====================================================

async function fetchRooms(type?: string): Promise<{ rooms: Room[]; stats: RoomStats }> {
  const params = new URLSearchParams()
  params.append('includeInactive', 'false')
  if (type && type !== 'all') {
    params.append('type', type)
  }

  const response = await api.get<{ 
    data: { rooms: Room[]; stats: RoomStats; total: number } 
  }>(`/api/rooms?${params.toString()}`)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch rooms')
  }

  return {
    rooms: response.data?.data?.rooms || [],
    stats: response.data?.data?.stats || { total: 0, available: 0, maintenance: 0, totalCapacity: 0 },
  }
}

async function fetchRoom(id: string): Promise<Room> {
  const response = await api.get<{ data: { room: Room } }>(`/api/rooms/${id}`)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch room')
  }

  return response.data?.data?.room as Room
}

async function createRoom(data: CreateRoomData): Promise<Room> {
  const response = await api.post<{ data: { room: Room } }>('/api/rooms', data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to create room')
  }

  return response.data?.data?.room as Room
}

async function updateRoom(id: string, data: UpdateRoomData): Promise<Room> {
  const response = await api.put<{ data: { room: Room } }>(`/api/rooms/${id}`, data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to update room')
  }

  return response.data?.data?.room as Room
}

async function deleteRoom(id: string): Promise<void> {
  const response = await api.delete<{ data: { message: string } }>(`/api/rooms/${id}`)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to delete room')
  }
}

// =====================================================
// Hooks
// =====================================================

// Fetch rooms list with optional type filter
export function useRoomsList(type?: string) {
  return useQuery({
    queryKey: roomKeys.list({ type }),
    queryFn: () => fetchRooms(type),
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  })
}

// Fetch single room
export function useRoom(id: string) {
  return useQuery({
    queryKey: roomKeys.detail(id),
    queryFn: () => fetchRoom(id),
    enabled: !!id,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  })
}

// Create room mutation
export function useCreateRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: roomKeys.all,
        refetchType: 'active',
      })
    },
  })
}

// Update room mutation
export function useUpdateRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoomData }) => updateRoom(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: roomKeys.detail(variables.id),
        refetchType: 'active',
      })
      queryClient.invalidateQueries({
        queryKey: roomKeys.lists(),
        refetchType: 'active',
      })
    },
  })
}

// Delete room mutation
export function useDeleteRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: roomKeys.all,
        refetchType: 'active',
      })
    },
  })
}

// Invalidate rooms cache
export function useInvalidateRooms() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => queryClient.invalidateQueries({
      queryKey: roomKeys.all,
      refetchType: 'active',
    }),
  }
}
