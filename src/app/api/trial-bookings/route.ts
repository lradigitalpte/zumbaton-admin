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
          created_at
        )
      `, { count: 'exact' })
      .eq('is_trial_booking', true)
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

    // Get total count and paginated results
    const { data: bookings, error, count } = await query
      .range(offset, offset + pageSize - 1)

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
    const formattedBookings = (bookings || []).map((booking: any) => {
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
        } : null,
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedBookings,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
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
