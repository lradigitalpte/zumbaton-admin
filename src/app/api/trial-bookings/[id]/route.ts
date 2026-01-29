/**
 * Trial Booking Management API
 * PATCH /api/trial-bookings/[id] - Update trial booking status
 * DELETE /api/trial-bookings/[id] - Delete trial booking
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// PATCH - Update trial booking status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, cancellationReason } = body

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['draft', 'confirmed', 'cancelled', 'attended', 'no-show']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()

    // Update booking
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'cancelled' && cancellationReason) {
      updateData.cancelled_at = new Date().toISOString()
      updateData.cancellation_reason = cancellationReason
    }

    const { data: updatedBooking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .eq('is_trial_booking', true) // Only allow updating trial bookings
      .select()
      .single()

    if (error) {
      console.error('[Trial Bookings API] Update error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update booking', details: error.message },
        { status: 500 }
      )
    }

    if (!updatedBooking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedBooking,
    })
  } catch (error) {
    console.error('[Trial Bookings API] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete trial booking (only draft bookings can be deleted)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseAdminClient()

    // First check if booking exists and is a draft trial booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status, is_trial_booking')
      .eq('id', id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    if (!booking.is_trial_booking) {
      return NextResponse.json(
        { success: false, error: 'Only trial bookings can be deleted' },
        { status: 400 }
      )
    }

    // Allow deleting draft, cancelled, and confirmed trial bookings
    // Prevent deleting attended bookings (they have attendance records)
    if (booking.status === 'attended') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete attended bookings. They have attendance records.' },
        { status: 400 }
      )
    }

    // Delete the booking
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id)
      .eq('is_trial_booking', true)

    if (deleteError) {
      console.error('[Trial Bookings API] Delete error:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete booking', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Booking deleted successfully',
    })
  } catch (error) {
    console.error('[Trial Bookings API] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
