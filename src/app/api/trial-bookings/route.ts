/**
 * Trial Bookings API
 * GET /api/trial-bookings - Fetch all trial bookings (guest bookings)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const supabase = getSupabaseAdminClient()
    const offset = (page - 1) * pageSize

    // Build query
    let query = supabase
      .from('bookings')
      .select(`
        id,
        guest_name,
        guest_email,
        guest_phone,
        guest_date_of_birth,
        status,
        booked_at,
        cancelled_at,
        cancellation_reason,
        payment_id,
        class_id,
        class:classes (
          id,
          title,
          scheduled_at,
          duration_minutes,
          location,
          instructor_name,
          class_type
        ),
        payment:payments (
          id,
          amount_cents,
          currency,
          status,
          created_at,
          hitpay_payment_request_id,
          metadata
        )
      `, { count: 'exact' })
      .eq('is_trial_booking', true)
      .or('cancellation_reason.is.null,cancellation_reason.not.ilike.%DUO COMPANION%')
      .order('booked_at', { ascending: false })

    // Apply status filter
    if (status) {
      query = query.eq('status', status)
    }

    // Apply search filter
    if (search) {
      query = query.or(`guest_name.ilike.%${search}%,guest_email.ilike.%${search}%,guest_phone.ilike.%${search}%`)
    }

    // Apply date filter (by booked_at)
    if (startDate) {
      query = query.gte('booked_at', startDate)
    }
    if (endDate) {
      query = query.lte('booked_at', endDate)
    }

    // Fetch matching bookings, then merge paid trial payments that do not yet
    // have a class/booking so Guest Bookings is also an operational follow-up list.
    const { data: bookings, error, count } = await query

    // Debug: confirm we're reading from DB (admin and web must use same Supabase project)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const dbHint = supabaseUrl ? `${supabaseUrl.replace(/https?:\/\//, '').slice(0, 30)}...` : 'NOT SET'
    console.log('[Trial Bookings API] DB:', dbHint, '| trial bookings count:', count ?? 0)
    
    if (error) {
      console.error('[Trial Bookings API] Error:', error)
      console.error('[Trial Bookings API] Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { success: false, error: 'Failed to fetch trial bookings', details: error.message },
        { status: 500 }
      )
    }
    
    if (bookings && bookings.length > 0) {
      console.log('[Trial Bookings API] Found bookings, sample:', {
        id: bookings[0].id,
        guest_email: bookings[0].guest_email,
        status: bookings[0].status,
        hasClass: !!bookings[0].class,
        hasPayment: !!bookings[0].payment
      })
    } else {
      console.log('[Trial Bookings API] No bookings found. Checking raw query...')
      // Try a simpler query without relations to see if bookings exist
      const { data: simpleBookings, error: simpleError } = await supabase
        .from('bookings')
        .select('id, guest_email, status, is_trial_booking')
        .eq('is_trial_booking', true)
        .limit(5)
      console.log('[Trial Bookings API] Simple query result:', { count: simpleBookings?.length ?? 0, error: simpleError })
    }

    // Format the response
    const formattedBookings = (bookings || [])
      .filter((booking: any) => {
        // Duo Trial (online payment) creates one booking row per participant so
        // each person counts toward class capacity, but only the payer's row
        // (the first id in draft_booking_ids) should surface in this list — the
        // 2nd participant's details already show as "P2 (2nd Guest)" on the
        // payer's row via payment.metadata.participant2. Their own row stays in
        // the DB (capacity/attendance still see it), it's just hidden here.
        const paymentData = booking.payment || (Array.isArray(booking.payments) ? booking.payments[0] : booking.payments)
        const draftIds = paymentData?.metadata?.draft_booking_ids
        if (Array.isArray(draftIds) && draftIds.length > 1 && draftIds[0] !== booking.id) {
          return false
        }
        return true
      })
      .map((booking: any) => {
      // Handle relation data (may be object or array depending on FK direction)
      const classData = booking.class || (Array.isArray(booking.classes) ? booking.classes[0] : booking.classes)
      const paymentData = booking.payment || (Array.isArray(booking.payments) ? booking.payments[0] : booking.payments)

      return {
        id: booking.id,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        guestPhone: booking.guest_phone,
        guestDateOfBirth: booking.guest_date_of_birth,
        status: booking.status,
        bookedAt: booking.booked_at,
        cancelledAt: booking.cancelled_at,
        cancellationReason: booking.cancellation_reason,
        paymentId: booking.payment_id,
        class: classData ? {
          id: classData.id,
          title: classData.title,
          scheduledAt: classData.scheduled_at,
          durationMinutes: classData.duration_minutes,
          location: classData.location,
          instructorName: classData.instructor_name,
          classType: classData.class_type,
          ageGroup: classData.age_group,
        } : null,
        payment: paymentData ? {
          id: paymentData.id,
          amountCents: paymentData.amount_cents,
          currency: paymentData.currency,
          status: paymentData.status,
          createdAt: paymentData.created_at,
          hitpayPaymentRequestId: paymentData.hitpay_payment_request_id,
          metadata: paymentData.metadata || null,
        } : null,
      }
    })

    let unscheduledQuery = supabase
      .from('payments')
      .select('id, amount_cents, currency, status, created_at, hitpay_payment_request_id, metadata')
      .eq('is_trial_booking', true)
      .in('status', ['succeeded', 'completed'])
      .is('class_id', null)
      .in('metadata->>flow_type', ['quick_trial', 'quick_join'])
      .eq('metadata->>needs_scheduling', 'true')
    if (startDate) unscheduledQuery = unscheduledQuery.gte('created_at', startDate)
    if (endDate) unscheduledQuery = unscheduledQuery.lte('created_at', endDate)
    const { data: unscheduledPayments, error: unscheduledError } = await unscheduledQuery
    if (unscheduledError) console.error('[Trial Bookings API] Unscheduled payments error:', unscheduledError)

    const bookingPaymentIds = new Set((bookings || []).map((booking: any) => booking.payment_id).filter(Boolean))
    const virtualBookings = (unscheduledPayments || [])
      .filter((payment: any) => !bookingPaymentIds.has(payment.id))
      .map((payment: any) => {
        const metadata = payment.metadata || {}
        return {
          id: `payment:${payment.id}`,
          guestName: metadata.guest_name || 'Guest',
          guestEmail: metadata.guest_email || '',
          guestPhone: metadata.guest_phone || '',
          guestDateOfBirth: null,
          status: 'needs_scheduling',
          bookedAt: payment.created_at,
          cancelledAt: null,
          cancellationReason: null,
          paymentId: payment.id,
          class: null,
          payment: {
            id: payment.id, amountCents: payment.amount_cents, currency: payment.currency,
            status: payment.status, createdAt: payment.created_at,
            hitpayPaymentRequestId: payment.hitpay_payment_request_id, metadata,
          },
        }
      })
      .filter((booking: any) => !search || [booking.guestName, booking.guestEmail, booking.guestPhone].some((value) => String(value).toLowerCase().includes(search.toLowerCase())))

    // Leads from /start whose HitPay payment hasn't cleared yet (or the webhook
    // missed it). Surfaced here too so staff can see the whole funnel in one
    // place and use the lead's "Sync" action to re-check HitPay.
    let pendingQuery = supabase
      .from('payments')
      .select('id, amount_cents, currency, status, created_at, hitpay_payment_request_id, metadata')
      .eq('is_trial_booking', true)
      .in('status', ['pending', 'in_progress'])
      .is('class_id', null)
      .in('metadata->>flow_type', ['quick_trial', 'quick_join'])
    if (startDate) pendingQuery = pendingQuery.gte('created_at', startDate)
    if (endDate) pendingQuery = pendingQuery.lte('created_at', endDate)
    const { data: pendingPayments, error: pendingError } = await pendingQuery
    if (pendingError) console.error('[Trial Bookings API] Pending payments error:', pendingError)

    const pendingBookings = (pendingPayments || [])
      .filter((payment: any) => !bookingPaymentIds.has(payment.id))
      .map((payment: any) => {
        const metadata = payment.metadata || {}
        return {
          id: `payment:${payment.id}`,
          guestName: metadata.guest_name || 'Guest',
          guestEmail: metadata.guest_email || '',
          guestPhone: metadata.guest_phone || '',
          guestDateOfBirth: null,
          status: 'pending_payment',
          bookedAt: payment.created_at,
          cancelledAt: null,
          cancellationReason: null,
          paymentId: payment.id,
          class: null,
          payment: {
            id: payment.id, amountCents: payment.amount_cents, currency: payment.currency,
            status: payment.status, createdAt: payment.created_at,
            hitpayPaymentRequestId: payment.hitpay_payment_request_id, metadata,
          },
        }
      })
      .filter((booking: any) => !search || [booking.guestName, booking.guestEmail, booking.guestPhone].some((value) => String(value).toLowerCase().includes(search.toLowerCase())))

    const virtualOnlyStatuses = ['needs_scheduling', 'pending_payment']
    const includeVirtual = !status || status === 'needs_scheduling'
    const includePending = !status || status === 'pending_payment'
    const combined = [
      ...(status && virtualOnlyStatuses.includes(status) ? [] : formattedBookings),
      ...(includeVirtual ? virtualBookings : []),
      ...(includePending ? pendingBookings : []),
    ].sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime())
    const paginated = combined.slice(offset, offset + pageSize)

    return NextResponse.json({
      success: true,
      data: paginated,
      pagination: {
        page,
        pageSize,
        total: combined.length,
        totalPages: Math.ceil(combined.length / pageSize),
      },
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
