import { supabase, getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import { consumeTokens } from './token.service'
import type {
  CheckInRequest,
  CheckInResponse,
  BulkCheckInRequest,
  BulkCheckInResponse,
  MarkNoShowRequest,
  MarkNoShowResponse,
} from '@/api/schemas'

// Check-in window: how early/late can someone check in
const CHECK_IN_WINDOW_BEFORE_MINUTES = 30 // 30 min before class
const CHECK_IN_WINDOW_AFTER_MINUTES = 15 // 15 min after class start

// Check in a single booking
export async function checkIn(params: {
  bookingId: string
  method: 'manual' | 'qr-code' | 'auto' | 'admin'
  checkedInBy: string
  notes?: string
}): Promise<CheckInResponse> {
  const { bookingId, method, checkedInBy, notes } = params
  const adminClient = getSupabaseAdminClient()

  // 1. Get booking with class info
  const { data: booking, error: fetchError } = await adminClient
    .from(TABLES.BOOKINGS)
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `)
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    throw new ApiError('NOT_FOUND_ERROR', 'Booking not found', 404)
  }

  if (booking.status !== 'confirmed') {
    throw new ApiError('VALIDATION_ERROR', `Cannot check in booking with status: ${booking.status}`, 400)
  }

  // 2. Validate check-in window
  const classTime = new Date(booking.class.scheduled_at)
  const now = new Date()
  const minutesUntilClass = (classTime.getTime() - now.getTime()) / (1000 * 60)
  const minutesAfterStart = -minutesUntilClass

  const canCheckIn = 
    (minutesUntilClass <= CHECK_IN_WINDOW_BEFORE_MINUTES && minutesUntilClass > 0) ||
    (minutesAfterStart >= 0 && minutesAfterStart <= CHECK_IN_WINDOW_AFTER_MINUTES)

  // Admin override
  if (!canCheckIn && method !== 'admin') {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Check-in window is ${CHECK_IN_WINDOW_BEFORE_MINUTES} minutes before to ${CHECK_IN_WINDOW_AFTER_MINUTES} minutes after class start`,
      400
    )
  }

  // 3. Consume tokens
  const tokenResult = await consumeTokens({
    userId: booking.user_id,
    userPackageId: booking.user_package_id,
    bookingId,
    tokensToConsume: booking.tokens_used,
    transactionType: 'attendance-consume',
    description: `Checked in via ${method}`,
    performedBy: checkedInBy,
  })

  // 4. Update booking status
  const { error: updateError } = await adminClient
    .from(TABLES.BOOKINGS)
    .update({
      status: 'attended',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (updateError) {
    throw new ApiError('SERVER_ERROR', 'Failed to update booking status', 500, updateError)
  }

  // 5. Create attendance record
  const { data: attendance, error: attendanceError } = await adminClient
    .from(TABLES.ATTENDANCES)
    .insert({
      booking_id: bookingId,
      checked_in_at: new Date().toISOString(),
      checked_in_by: checkedInBy,
      check_in_method: method,
      notes: notes || null,
    })
    .select()
    .single()

  if (attendanceError) {
    // Log but don't fail - booking is already marked as attended
    console.error('[AttendanceService] Failed to create attendance record:', attendanceError)
  }

  return {
    attendance: {
      id: attendance?.id || 'pending',
      bookingId,
      checkedInAt: attendance?.checked_in_at || new Date().toISOString(),
      checkedInBy,
      checkInMethod: method,
      notes: notes || null,
      createdAt: attendance?.created_at || new Date().toISOString(),
    },
    tokensConsumed: booking.tokens_used,
    tokensRemaining: tokenResult.newBalance,
    message: `Successfully checked in. ${booking.tokens_used} token(s) consumed.`,
  }
}

// Bulk check-in (admin)
export async function bulkCheckIn(params: {
  bookingIds: string[]
  method: 'admin'
  checkedInBy: string
  notes?: string
}): Promise<BulkCheckInResponse> {
  const { bookingIds, method, checkedInBy, notes } = params
  const adminClient = getSupabaseAdminClient()

  const successful: { bookingId: string; attendanceId: string; userName: string }[] = []
  const failed: { bookingId: string; error: string }[] = []

  for (const bookingId of bookingIds) {
    try {
      // Get booking to get user name
      const { data: booking } = await adminClient
        .from(TABLES.BOOKINGS)
        .select('user_id, users(name)')
        .eq('id', bookingId)
        .single()

      const result = await checkIn({
        bookingId,
        method,
        checkedInBy,
        notes,
      })

      successful.push({
        bookingId,
        attendanceId: result.attendance.id,
        userName: (booking as unknown as { users: { name: string } })?.users?.name || 'Unknown',
      })
    } catch (error) {
      failed.push({
        bookingId,
        error: error instanceof ApiError ? error.message : 'Unknown error',
      })
    }
  }

  return {
    successful,
    failed,
    summary: {
      totalProcessed: bookingIds.length,
      totalSuccessful: successful.length,
      totalFailed: failed.length,
    },
  }
}

// Mark booking as no-show
export async function markNoShow(params: {
  bookingId: string
  markedBy: string
  notes?: string
}): Promise<MarkNoShowResponse> {
  const { bookingId, markedBy, notes } = params
  const adminClient = getSupabaseAdminClient()

  // 1. Get booking
  const { data: booking, error: fetchError } = await adminClient
    .from(TABLES.BOOKINGS)
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `)
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    throw new ApiError('NOT_FOUND_ERROR', 'Booking not found', 404)
  }

  if (booking.status !== 'confirmed') {
    throw new ApiError('VALIDATION_ERROR', `Cannot mark as no-show: booking status is ${booking.status}`, 400)
  }

  // 2. Check class has ended (or is in progress past check-in window)
  const classTime = new Date(booking.class.scheduled_at)
  const classEndTime = new Date(classTime.getTime() + booking.class.duration_minutes * 60 * 1000)
  const now = new Date()

  if (now < classTime) {
    throw new ApiError('VALIDATION_ERROR', 'Cannot mark as no-show before class starts', 400)
  }

  // 3. Consume tokens
  const tokenResult = await consumeTokens({
    userId: booking.user_id,
    userPackageId: booking.user_package_id,
    bookingId,
    tokensToConsume: booking.tokens_used,
    transactionType: 'no-show-consume',
    description: `No-show for class ${booking.class.title}`,
    performedBy: markedBy,
  })

  // 4. Update booking status
  const { error: updateError } = await adminClient
    .from(TABLES.BOOKINGS)
    .update({
      status: 'no-show',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (updateError) {
    throw new ApiError('SERVER_ERROR', 'Failed to update booking status', 500, updateError)
  }

  // 5. Get/update user's no-show count
  const { data: userStats } = await adminClient
    .from(TABLES.BOOKINGS)
    .select('id')
    .eq('user_id', booking.user_id)
    .eq('status', 'no-show')

  const noShowCount = (userStats?.length || 0)
  const userFlagged = noShowCount >= 3

  // TODO: If userFlagged, create notification/flag in user profile

  return {
    bookingId,
    tokensConsumed: booking.tokens_used,
    userNoShowCount: noShowCount,
    userFlagged,
    message: userFlagged
      ? `Marked as no-show. User has ${noShowCount} no-shows and has been flagged.`
      : `Marked as no-show. ${booking.tokens_used} token(s) consumed.`,
  }
}

// Process no-shows for ended classes (scheduled job)
export async function processNoShows(): Promise<{
  processed: number
  failed: number
}> {
  const adminClient = getSupabaseAdminClient()
  
  // Find bookings for classes that ended more than 30 minutes ago
  // and are still in 'confirmed' status
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { data: bookings, error } = await adminClient
    .from(TABLES.BOOKINGS)
    .select(`
      id,
      user_id,
      class:${TABLES.CLASSES}!inner(
        scheduled_at,
        duration_minutes
      )
    `)
    .eq('status', 'confirmed')

  if (error) {
    console.error('[AttendanceService] Failed to fetch bookings for no-show processing:', error)
    return { processed: 0, failed: 0 }
  }

  let processed = 0
  let failed = 0

  for (const booking of bookings || []) {
    const classData = (booking.class as unknown) as { scheduled_at: string; duration_minutes: number }
    const classEndTime = new Date(
      new Date(classData.scheduled_at).getTime() +
      classData.duration_minutes * 60 * 1000
    )
    const graceEndTime = new Date(classEndTime.getTime() + 30 * 60 * 1000)

    if (new Date() > graceEndTime) {
      try {
        await markNoShow({
          bookingId: booking.id,
          markedBy: 'system',
          notes: 'Auto-processed no-show',
        })
        processed++
      } catch (err) {
        console.error(`[AttendanceService] Failed to process no-show for booking ${booking.id}:`, err)
        failed++
      }
    }
  }

  return { processed, failed }
}
