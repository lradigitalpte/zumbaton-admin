// Rooms API Route
// CRUD operations for rooms/studios

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'

interface RoomRow {
  id: string
  name: string
  description: string | null
  capacity: number
  location: string | null
  room_type: string
  amenities: string[] | null
  status: string
  color: string | null
  is_active: boolean
  sort_order: number
}

function mapRoomToResponse(room: RoomRow) {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    capacity: room.capacity,
    location: room.location,
    type: room.room_type || 'studio',
    amenities: room.amenities || [],
    status: room.status || 'available',
    color: room.color || 'amber',
    isActive: room.is_active,
    sortOrder: room.sort_order,
  }
}

// GET /api/rooms - List all rooms
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const type = searchParams.get('type')
    
    let query = supabase
      .from('rooms')
      .select('*')
      .order('sort_order', { ascending: true })
    
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }
    
    if (type && type !== 'all') {
      query = query.eq('room_type', type)
    }

    const { data, error } = await query

    if (error) {
      console.error('[API /rooms] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to fetch rooms',
        },
      }, { status: 500 })
    }

    const rooms = ((data || []) as RoomRow[]).map(mapRoomToResponse)

    // Calculate stats
    const stats = {
      total: rooms.length,
      available: rooms.filter(r => r.status === 'available').length,
      maintenance: rooms.filter(r => r.status === 'maintenance').length,
      totalCapacity: rooms.filter(r => r.status === 'available').reduce((sum, r) => sum + r.capacity, 0),
    }

    return NextResponse.json({
      success: true,
      data: {
        rooms,
        stats,
        total: rooms.length,
      },
    })
  } catch (error) {
    console.error('[API /rooms]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

// POST /api/rooms - Create a new room
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const body = await request.json()

    const { name, description, capacity, location, type, amenities, status, color } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Room name is required',
        },
      }, { status: 400 })
    }

    // Get max sort_order
    const { data: maxOrderData } = await supabase
      .from('rooms')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()
    
    const nextSortOrder = (maxOrderData?.sort_order || 0) + 1

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        name,
        description: description || null,
        capacity: capacity || 20,
        location: location || null,
        room_type: type || 'studio',
        amenities: amenities || [],
        status: status || 'available',
        color: color || 'amber',
        is_active: true,
        sort_order: nextSortOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('[API /rooms POST] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to create room',
        },
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        room: mapRoomToResponse(data as RoomRow),
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[API /rooms POST]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}
