import { supabase, TABLES, isSupabaseError, SUPABASE_ERRORS } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import { holdTokens, releaseTokens, consumeTokens } from './token.service'
import type {
  Booking,
  BookingWithClass,
  CreateBookingRequest,
  CancelBookingRequest,
  BookingResponse,
  CancelBookingResponse,
} from '@/api/schemas'

// Configuration
const CANCELLATION_WINDOW_HOURS = 4 // Free cancellation up to 4 hours before class

interface CreateBookingParams {
  userId: string
  classId: string
}

interface CancelBookingParams {
  userId: string
  bookingId: string
  reason?: string
}

// Create a booking (hold tokens)
export async function createBooking(params: CreateBookingParams): Promise<BookingResponse> {
  const { userId, classId } = params

  // 1. Check if class exists and has availability
  const { data: classData, error: classError } = await supabase
    .from(TABLES.CLASSES)
    .select(`
      *,
      bookings:${TABLES.BOOKINGS}(count)
    `)
    .eq('id', classId)
    .eq('status', 'scheduled')
    .single()

  if (classError || !classData) {
    throw new ApiError('NOT_FOUND_ERROR', 'Class not found or not available', 404)
  }

  // Check if class is in the future
  if (new Date(classData.scheduled_at) <= new Date()) {
    throw new ApiError('VALIDATION_ERROR', 'Cannot book past classes', 400)
  }

  // Check capacity
  const bookedCount = classData.bookings?.[0]?.count || 0
  if (bookedCount >= classData.capacity) {
    throw new ApiError('VALIDATION_ERROR', 'Class is full. Join the waitlist instead.', 400)
  }

  // 2. Check if user already has a booking for this class
  const { data: existingBooking } = await supabase
    .from(TABLES.BOOKINGS)
    .select('id, status')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .in('status', ['confirmed', 'waitlist'])
    .single()

  if (existingBooking) {
    throw new ApiError('CONFLICT_ERROR', 'You already have a booking for this class', 409)
  }

  // 3. Hold tokens
  const tokenResult = await holdTokens({
    userId,
    tokensNeeded: classData.token_cost,
    bookingId: '', // will be set after booking created
    classType: classData.class_type,
  })

  // 4. Create booking
  const { data: booking, error: bookingError } = await supabase
    .from(TABLES.BOOKINGS)
    .insert({
      user_id: userId,
      class_id: classId,
      user_package_id: tokenResult.userPackageId,
      tokens_used: classData.token_cost,
      status: 'confirmed',
      booked_at: new Date().toISOString(),
    })
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `)
    .single()

  if (bookingError) {
    // Rollback: release tokens
    await releaseTokens({
      userId,
      userPackageId: tokenResult.userPackageId,
      bookingId: '',
      tokensToRelease: classData.token_cost,
      description: 'Rollback: booking creation failed',
    })

    if (isSupabaseError(bookingError, SUPABASE_ERRORS.UNIQUE_VIOLATION)) {
      throw new ApiError('CONFLICT_ERROR', 'You already have a booking for this class', 409)
    }
    throw new ApiError('SERVER_ERROR', 'Failed to create booking', 500, bookingError)
  }

  return {
    booking: mapBookingToSchema(booking),
    tokensHeld: classData.token_cost,
    tokensAvailable: tokenResult.newBalance,
    message: `Successfully booked ${classData.title}. ${classData.token_cost} token(s) held.`,
  }
}

// Cancel a booking (release or consume tokens based on timing)
export async function cancelBooking(params: CancelBookingParams): Promise<CancelBookingResponse> {
  const { userId, bookingId, reason } = params

  // 1. Get booking
  const { data: booking, error: fetchError } = await supabase
    .from(TABLES.BOOKINGS)
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `)
    .eq('id', bookingId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !booking) {
    throw new ApiError('NOT_FOUND_ERROR', 'Booking not found', 404)
  }

  if (booking.status !== 'confirmed') {
    throw new ApiError('VALIDATION_ERROR', `Cannot cancel booking with status: ${booking.status}`, 400)
  }

  // 2. Check if within cancellation window
  const classTime = new Date(booking.class.scheduled_at)
  const now = new Date()
  const hoursUntilClass = (classTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  const isWithinWindow = hoursUntilClass >= CANCELLATION_WINDOW_HOURS
  const isPenalty = !isWithinWindow && hoursUntilClass > 0 // only penalty if class hasn't started

  let newStatus: 'cancelled' | 'cancelled-late'
  let tokensRefunded = 0

  if (isWithinWindow) {
    // Free cancellation - release tokens
    newStatus = 'cancelled'
    tokensRefunded = booking.tokens_used

    await releaseTokens({
      userId,
      userPackageId: booking.user_package_id,
      bookingId,
      tokensToRelease: booking.tokens_used,
      description: `Cancelled within ${CANCELLATION_WINDOW_HOURS}h window`,
    })
  } else if (isPenalty) {
    // Late cancellation - consume tokens as penalty
    newStatus = 'cancelled-late'
    tokensRefunded = 0

    await consumeTokens({
      userId,
      userPackageId: booking.user_package_id,
      bookingId,
      tokensToConsume: booking.tokens_used,
      transactionType: 'late-cancel-consume',
      description: `Late cancellation penalty (within ${CANCELLATION_WINDOW_HOURS}h of class)`,
    })
  } else {
    // Class already started/ended
    throw new ApiError('VALIDATION_ERROR', 'Cannot cancel after class has started', 400)
  }

  // 3. Update booking
  const { data: updatedBooking, error: updateError } = await supabase
    .from(TABLES.BOOKINGS)
    .update({
      status: newStatus,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single()

  if (updateError) {
    throw new ApiError('SERVER_ERROR', 'Failed to cancel booking', 500, updateError)
  }

  // 4. TODO: Process waitlist - notify next person

  return {
    booking: mapBookingToSchema(updatedBooking),
    tokensRefunded,
    penalty: isPenalty,
    penaltyReason: isPenalty ? `Cancelled less than ${CANCELLATION_WINDOW_HOURS} hours before class` : undefined,
    message: isPenalty
      ? `Booking cancelled. ${booking.tokens_used} token(s) consumed as late cancellation penalty.`
      : `Booking cancelled. ${tokensRefunded} token(s) refunded.`,
  }
}

// Get user's bookings
export async function getUserBookings(params: {
  userId: string
  status?: string
  upcoming?: boolean
  page?: number
  pageSize?: number
}) {
  const { userId, status, upcoming, page = 1, pageSize = 20 } = params

  let query = supabase
    .from(TABLES.BOOKINGS)
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `, { count: 'exact' })
    .eq('user_id', userId)
    .order('booked_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  if (upcoming) {
    query = query.gt('class.scheduled_at', new Date().toISOString())
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch bookings', 500, error)
  }

  return {
    bookings: (data || []).map(mapBookingToSchema),
    total: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > page * pageSize,
  }
}

// Helper: Map database row to schema
function mapBookingToSchema(row: Record<string, unknown>): BookingWithClass {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    classId: row.class_id as string,
    userPackageId: row.user_package_id as string | null,
    tokensUsed: row.tokens_used as number,
    status: row.status as 'confirmed' | 'waitlist' | 'cancelled' | 'cancelled-late' | 'attended' | 'no-show',
    bookedAt: row.booked_at as string,
    cancelledAt: row.cancelled_at as string | null,
    cancellationReason: row.cancellation_reason as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    class: row.class ? mapClassToSchema(row.class as Record<string, unknown>) : undefined,
  }
}

function mapClassToSchema(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | null,
    classType: row.class_type as 'zumba',
    level: row.level as 'all_levels',
    instructorId: row.instructor_id as string | null,
    instructorName: row.instructor_name as string | null,
    scheduledAt: row.scheduled_at as string,
    durationMinutes: row.duration_minutes as number,
    capacity: row.capacity as number,
    tokenCost: row.token_cost as number,
    location: row.location as string | null,
    status: row.status as 'scheduled',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
