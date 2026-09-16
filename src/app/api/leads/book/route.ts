/**
 * Book a lead into a class.
 * POST /api/leads/book  { leadId, classId }
 *
 * Creates a confirmed (trial) booking for the lead's guest in the chosen class
 * — same shape the public trial flow produces — so it counts against capacity
 * and shows up in attendance. Marks the lead as scheduled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { sendAdminEmail } from '@/lib/admin-email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    if (!['super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
    }

    const body = await request.json()
    const leadId = body?.leadId as string | undefined
    const classId = body?.classId as string | undefined
    if (!leadId || !classId) {
      return NextResponse.json({ success: false, error: { message: 'Missing leadId or classId' } }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()

    // Support both paid quick-join leads and imported marketing leads.
    const { data: paymentLead } = await supabase
      .from('payments')
      .select('id, metadata')
      .eq('id', leadId)
      .single()
    const { data: marketingLead } = paymentLead ? { data: null } : await supabase
      .from('marketing_leads')
      .select('id, name, email, phone, status')
      .eq('id', leadId)
      .single()
    if (!paymentLead && !marketingLead) {
      return NextResponse.json({ success: false, error: { message: 'Lead not found' } }, { status: 404 })
    }
    const metadata = (paymentLead?.metadata as Record<string, any>) || {}

    const { data: classData, error: classErr } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single()
    if (classErr || !classData) {
      return NextResponse.json({ success: false, error: { message: 'Class not found' } }, { status: 404 })
    }
    if (classData.status !== 'scheduled') {
      return NextResponse.json({ success: false, error: { message: 'Class is not open for booking' } }, { status: 400 })
    }

    // Capacity check
    const { data: existing } = await supabase
      .from('bookings')
      .select('id, payment_id, marketing_lead_id')
      .eq('class_id', classId)
      .in('status', ['confirmed', 'attended'])

    const bookedCount = existing?.length || 0
    if (bookedCount >= classData.capacity) {
      return NextResponse.json({ success: false, error: { message: 'This class is full' } }, { status: 400 })
    }
    // Avoid duplicate booking for the same lead + class
    if ((existing || []).some((b) => b.payment_id === leadId || b.marketing_lead_id === leadId)) {
      return NextResponse.json({ success: false, error: { message: 'This lead is already booked in this class' } }, { status: 400 })
    }

    const guestName = marketingLead?.name || (metadata.guest_name as string) || 'Guest'
    const guestEmail = marketingLead?.email || (metadata.guest_email as string) || ''
    const guestPhone = marketingLead?.phone || (metadata.guest_phone as string) || ''
    if (!guestEmail) {
      return NextResponse.json({ success: false, error: { message: 'Add an email address before booking this lead' } }, { status: 400 })
    }

    const companionName = (metadata.companion_name as string) || ''
    const companionEmail = (metadata.companion_email as string) || ''
    const companionPhone = (metadata.companion_phone as string) || ''
    const hasCompanion = Boolean(companionName && companionEmail)
    const spotsNeeded = hasCompanion ? 2 : 1
    if (bookedCount + spotsNeeded > classData.capacity) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: hasCompanion
              ? 'Not enough spots left in this class for both guests'
              : 'This class is full',
          },
        },
        { status: 400 }
      )
    }

    const bookingsToInsert = [
      {
        class_id: classId,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        is_trial_booking: true,
        payment_id: paymentLead ? leadId : null,
        marketing_lead_id: marketingLead ? leadId : null,
        status: 'confirmed' as const,
        tokens_used: 0,
        booked_at: new Date().toISOString(),
      },
    ]
    if (hasCompanion) {
      bookingsToInsert.push({
        class_id: classId,
        guest_name: companionName,
        guest_email: companionEmail,
        guest_phone: companionPhone,
        is_trial_booking: true,
        payment_id: paymentLead ? leadId : null,
        marketing_lead_id: marketingLead ? leadId : null,
        status: 'confirmed' as const,
        tokens_used: 0,
        booked_at: new Date().toISOString(),
      })
    }

    const { data: insertedBookings, error: bookingErr } = await supabase
      .from('bookings')
      .insert(bookingsToInsert)
      .select('id, guest_name, guest_email')

    if (bookingErr || !insertedBookings || insertedBookings.length === 0) {
      console.error('[API /leads/book] Booking insert error:', bookingErr)
      return NextResponse.json({ success: false, error: { message: bookingErr?.message || 'Failed to create booking' } }, { status: 500 })
    }
    const booking = insertedBookings[0]
    const companionBooking = hasCompanion ? insertedBookings[1] : null

    // Mark lead scheduled + record the class on the lead
    if (paymentLead) await supabase.from('payments').update({
        metadata: {
          ...metadata,
          lead_status: 'scheduled',
          booked_class_id: classId,
          booked_booking_id: booking.id,
          booked_companion_booking_id: companionBooking?.id || null,
          booked_class_title: classData.title,
          booked_class_at: classData.scheduled_at,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
    if (marketingLead) {
      await supabase.from('marketing_leads').update({ status: 'trial_scheduled', updated_at: new Date().toISOString() }).eq('id', leadId)
      await supabase.from('lead_activities').insert({ lead_id: leadId, actor_id: user.id, activity_type: 'status_changed', note: `Booked into ${classData.title}`, new_values: { status: 'trial_scheduled', class_id: classId, booking_id: booking.id } })
    }

    // Send a booking-confirmation email to the client, and the friend if there is one (best-effort).
    const scheduledAt = new Date(classData.scheduled_at)
    const classDate = scheduledAt.toLocaleDateString('en-SG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Singapore',
    })
    const classTime = scheduledAt.toLocaleTimeString('en-SG', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore',
    })
    const sendConfirmation = async (toEmail: string, toName: string) => {
      const realEmail = toEmail && toEmail.includes('@') && !toEmail.includes('@guest.')
      if (!realEmail) return false
      try {
        const emailResult = await sendAdminEmail('booking-confirmation', {
          userEmail: toEmail,
          userName: toName,
          className: classData.title,
          classDate,
          classTime,
          classLocation: classData.location || classData.room_name || 'TBA',
          tokensUsed: 0,
          instructorName: classData.instructor_name || undefined,
        })
        if (!emailResult.success) {
          console.warn('[API /leads/book] Confirmation email not sent:', emailResult.error)
        }
        return emailResult.success
      } catch (emailErr) {
        console.error('[API /leads/book] Confirmation email error:', emailErr)
        return false
      }
    }

    const emailSent = await sendConfirmation(guestEmail, guestName)
    const companionEmailSent = companionBooking ? await sendConfirmation(companionEmail, companionName) : false

    return NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        companionBookingId: companionBooking?.id || null,
        classTitle: classData.title,
        classAt: classData.scheduled_at,
        emailSent,
        companionEmailSent,
      },
    })
  } catch (error) {
    console.error('[API /leads/book]', error)
    return NextResponse.json({ success: false, error: { message: 'Server error' } }, { status: 500 })
  }
}
