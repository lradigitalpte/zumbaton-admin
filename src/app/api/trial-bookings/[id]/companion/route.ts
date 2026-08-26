/**
 * API Route: Add / Edit Companion (2nd Guest) for Trial Booking
 * POST /api/trial-bookings/[id]/companion
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { guestName, guestPhone, guestDateOfBirth, guestEmail, gender } = body

    if (!guestName || !guestName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Companion name is required' },
        { status: 400 }
      )
    }

    if (!guestPhone || !guestPhone.trim()) {
      return NextResponse.json(
        { success: false, error: 'Companion phone number is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()

    // 1. Fetch primary booking
    const { data: primaryBooking, error: primaryError } = await supabase
      .from('bookings')
      .select(`
        *,
        payment:payments(*)
      `)
      .eq('id', id)
      .eq('is_trial_booking', true)
      .single()

    if (primaryError || !primaryBooking) {
      console.error('[Add Companion API] Primary booking not found:', primaryError)
      return NextResponse.json(
        { success: false, error: 'Primary booking not found' },
        { status: 404 }
      )
    }

    // 2. Resolve email (or placeholder email if empty)
    const cleanPhone = guestPhone.trim().replace(/\D/g, '')
    let resolvedEmail = guestEmail && guestEmail.trim()
      ? guestEmail.trim().toLowerCase()
      : `guest+${cleanPhone}@guest.onestepfitness.sg`

    // 3. Prepare participant2 object
    const participant2 = {
      name: guestName.trim(),
      email: resolvedEmail,
      phone: guestPhone.trim(),
      dateOfBirth: guestDateOfBirth ? guestDateOfBirth.trim() : null,
      gender: gender || null,
      addedByAdmin: true,
      addedAt: new Date().toISOString(),
    }

    let paymentId = primaryBooking.payment_id
    let existingMeta = (primaryBooking.payment?.metadata as Record<string, any>) || {}

    const updatedMeta = {
      ...existingMeta,
      flow_type: 'duo_trial',
      participant1: existingMeta.participant1 || {
        name: primaryBooking.guest_name,
        email: primaryBooking.guest_email,
        phone: primaryBooking.guest_phone,
        dateOfBirth: primaryBooking.guest_date_of_birth,
      },
      participant2,
    }

    if (!paymentId) {
      // Create a payment record to hold the metadata without creating duplicate booking rows
      const { data: newPayment, error: paymentCreateErr } = await supabase
        .from('payments')
        .insert({
          class_id: primaryBooking.class_id,
          is_trial_booking: true,
          amount_cents: 0,
          currency: 'SGD',
          status: 'succeeded',
          provider: 'manual',
          metadata: updatedMeta,
        })
        .select()
        .single()

      if (paymentCreateErr) {
        console.error('[Add Companion API] Error creating payment:', paymentCreateErr)
      } else if (newPayment) {
        paymentId = newPayment.id
      }
    } else {
      // Update existing payment metadata
      const { error: paymentUpdateErr } = await supabase
        .from('payments')
        .update({ metadata: updatedMeta })
        .eq('id', paymentId)

      if (paymentUpdateErr) {
        console.warn('[Add Companion API] Error updating payment metadata:', paymentUpdateErr)
      }
    }

    // 4. Update primary booking's cancellation_reason tag & payment_id ONLY (No extra booking row created!)
    const companionTag = `Companion: ${guestName.trim()} (${guestPhone.trim()}) | DOB: ${guestDateOfBirth ? guestDateOfBirth.trim() : 'N/A'} | Gender: ${gender || 'N/A'}`
    let newReason = primaryBooking.cancellation_reason || ''
    if (!newReason.includes('Companion:')) {
      newReason = newReason ? `${newReason} | ${companionTag}` : companionTag
    } else {
      newReason = newReason.replace(/Companion: [^|]+(?:\| DOB: [^|]+)?(?:\| Gender: [^|]+)?/, companionTag)
    }

    const { data: updatedBooking, error: primaryUpdateErr } = await supabase
      .from('bookings')
      .update({
        payment_id: paymentId || primaryBooking.payment_id,
        cancellation_reason: newReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', primaryBooking.id)
      .select()
      .single()

    if (primaryUpdateErr) {
      console.error('[Add Companion API] Error updating primary booking:', primaryUpdateErr)
      return NextResponse.json(
        { success: false, error: 'Failed to update booking with companion details' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Companion details attached to primary booking successfully',
      data: updatedBooking,
    })
  } catch (error) {
    console.error('[Add Companion API] Unexpected error:', error)
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
