// Room API Route - Single room operations
// PUT/DELETE for individual rooms

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

// GET /api/rooms/[roomId] - Get single room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (error || !data) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Room not found',
        },
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        room: mapRoomToResponse(data as RoomRow),
      },
    })
  } catch (error) {
    console.error('[API /rooms/[roomId] GET]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

// PUT /api/rooms/[roomId] - Update room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = getSupabaseAdminClient()
    const body = await request.json()

    const { name, description, capacity, location, type, amenities, status, color } = body

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (capacity !== undefined) updateData.capacity = capacity
    if (location !== undefined) updateData.location = location
    if (type !== undefined) updateData.room_type = type
    if (amenities !== undefined) updateData.amenities = amenities
    if (status !== undefined) updateData.status = status
    if (color !== undefined) updateData.color = color

    const { data, error } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', roomId)
      .select()
      .single()

    if (error) {
      console.error('[API /rooms/[roomId] PUT] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to update room',
        },
      }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Room not found',
        },
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        room: mapRoomToResponse(data as RoomRow),
      },
    })
  } catch (error) {
    console.error('[API /rooms/[roomId] PUT]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

// DELETE /api/rooms/[roomId] - Delete room (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = getSupabaseAdminClient()

    // Soft delete - just mark as inactive
    const { error } = await supabase
      .from('rooms')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId)

    if (error) {
      console.error('[API /rooms/[roomId] DELETE] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to delete room',
        },
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Room deleted successfully',
      },
    })
  } catch (error) {
    console.error('[API /rooms/[roomId] DELETE]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}
