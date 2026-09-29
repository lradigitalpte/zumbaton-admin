import { supabase, getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import { getUserTokenBalance } from './token.service'
import { updateUserStreak, incrementUserStat, updateLastClassAt } from './user.service'
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

// Mark a booking as attended. Tokens were already spent at booking time, so this
// never touches the token balance.
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

  // Admin and the after-class job can mark attendance at any time
  if (!canCheckIn && method !== 'admin' && method !== 'auto') {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Check-in window is ${CHECK_IN_WINDOW_BEFORE_MINUTES} minutes before to ${CHECK_IN_WINDOW_AFTER_MINUTES} minutes after class start`,
      400
    )
  }

  // 3. Update booking status
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

  // 4. Create attendance record
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(checkedInBy)
  const { data: attendance, error: attendanceError } = await adminClient
    .from(TABLES.ATTENDANCES)
    .insert({
      booking_id: bookingId,
      checked_in_at: new Date().toISOString(),
      checked_in_by: isValidUUID ? checkedInBy : null,
      check_in_method: method,
      notes: notes || null,
    })
    .select()
    .single()

  if (attendanceError) {
    // Log but don't fail - booking is already marked as attended
    console.error('[AttendanceService] Failed to create attendance record:', attendanceError)
  }

  // 5. Update user stats (attendance count and streak)
  try {
    await incrementUserStat(booking.user_id, 'totalClassesAttended', 1)
    await updateUserStreak(booking.user_id, classTime)
    await updateLastClassAt(booking.user_id)
  } catch (statsError) {
    // Log but don't fail - check-in was successful
    console.error('[AttendanceService] Failed to update user stats:', statsError)
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
    tokensConsumed: 0,
    tokensRemaining: (await getUserTokenBalance(booking.user_id, adminClient)).availableTokens,
    message: 'Marked as attended.',
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

// Mark booking as no-show (staff action). Tokens were already spent at booking time,
// so this only records the no-show for stats and flagging.
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

  // Bookings auto-marked attended after class can still be corrected to no-show by staff
  const wasAttended = booking.status === 'attended'
  if (booking.status !== 'confirmed' && !wasAttended) {
    throw new ApiError('VALIDATION_ERROR', `Cannot mark as no-show: booking status is ${booking.status}`, 400)
  }

  // 2. Class must have started
  const classTime = new Date(booking.class.scheduled_at)
  if (new Date() < classTime) {
    throw new ApiError('VALIDATION_ERROR', 'Cannot mark as no-show before class starts', 400)
  }

  // 3. Update booking status
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

  // 4. Undo the attendance record/stat if the job had auto-marked them attended
  if (wasAttended) {
    await adminClient.from(TABLES.ATTENDANCES).delete().eq('booking_id', bookingId)
    try {
      await incrementUserStat(booking.user_id, 'totalClassesAttended', -1)
    } catch (statsError) {
      console.error('[AttendanceService] Failed to decrement attended count:', statsError)
    }
  }

  // 5. Get/update user's no-show count
  const { data: userStats } = await adminClient
    .from(TABLES.BOOKINGS)
    .select('id')
    .eq('user_id', booking.user_id)
    .eq('status', 'no-show')

  const noShowCount = (userStats?.length || 0)
  const userFlagged = noShowCount >= 3

  console.log(`[AttendanceService] Updating no-show count for user ${booking.user_id}: ${noShowCount} no-shows, flagged: ${userFlagged}`)

  // 5a. Update user_profiles with the new no-show count
  const { error: profileUpdateError } = await adminClient
    .from('user_profiles')
    .update({ 
      no_show_count: noShowCount,
      is_flagged: userFlagged
    })
    .eq('id', booking.user_id)

  if (profileUpdateError) {
    console.error('[AttendanceService] Failed to update user_profiles:', JSON.stringify(profileUpdateError))
  } else {
    console.log('[AttendanceService] Successfully updated user_profiles')
  }

  // 5b. Update user_stats with the new no-show count
  const { error: statsUpdateError } = await adminClient
    .from('user_stats')
    .update({ 
      total_no_shows: noShowCount,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', booking.user_id)

  if (statsUpdateError) {
    console.error('[AttendanceService] Failed to update user_stats:', JSON.stringify(statsUpdateError))
  } else {
    console.log('[AttendanceService] Successfully updated user_stats')
  }

  // 6. Send no-show warning notification to user
  try {
    const { sendNotification } = await import('./notification.service')
    
    // Get user profile
    const { data: userProfile } = await adminClient
      .from('user_profiles')
      .select('name, email')
      .eq('id', booking.user_id)
      .single()

    const classDate = new Date(booking.class.scheduled_at)
    const formattedDate = classDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const formattedTime = classDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    })

    // Send in-app notification
    await sendNotification({
      userId: booking.user_id,
      type: 'no_show_warning',
      channel: 'in_app',
      data: {
        user_name: userProfile?.name || 'User',
        class_title: booking.class.title,
        class_date: formattedDate,
        class_time: formattedTime,
        tokens_consumed: booking.tokens_used, // spent at booking; not refunded for a no-show
        no_show_count: noShowCount,
        is_flagged: userFlagged,
        message: userFlagged
          ? `You missed "${booking.class.title}" on ${formattedDate}. This is your ${noShowCount}${noShowCount === 1 ? 'st' : noShowCount === 2 ? 'nd' : noShowCount === 3 ? 'rd' : 'th'} no-show. Your account has been flagged.`
          : `You missed "${booking.class.title}" on ${formattedDate}.`,
      },
    })

    // Send email notification via web app API
    if (userProfile?.email) {
      const { getWebAppUrl } = await import('@/lib/email-url')
      const webAppUrl = getWebAppUrl()
      const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'

      await fetch(`${webAppUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'no-show-warning',
          secret: emailApiSecret,
          data: {
            userEmail: userProfile.email,
            userName: userProfile.name || 'User',
            className: booking.class.title,
            classDate: formattedDate,
            classTime: formattedTime,
            tokensConsumed: booking.tokens_used, // spent at booking; not refunded for a no-show
            noShowCount,
            isFlagged: userFlagged,
          },
        }),
      })
      console.log(`[AttendanceService] No-show warning email sent to ${userProfile.email}`)
    }
  } catch (notificationError) {
    console.error('[AttendanceService] Error sending no-show notification:', notificationError)
  }

  return {
    bookingId,
    tokensConsumed: 0,
    userNoShowCount: noShowCount,
    userFlagged,
    message: userFlagged
      ? `Marked as no-show. User has ${noShowCount} no-shows and has been flagged.`
      : 'Marked as no-show.',
  }
}

// Mark bookings as attended once their class has ended (scheduled job).
// There is no QR check-in: everyone still booked is treated as attended, and staff
// can correct individual bookings to no-show afterwards. Tokens are never touched here.
export async function processCompletedBookings(): Promise<{
  processed: number
  failed: number
  errors?: string[]
}> {
  const adminClient = getSupabaseAdminClient()
  const errors: string[] = []
  
  // Find bookings for classes that ended more than 30 minutes ago
  // and are still in 'confirmed' status
  const { data: bookings, error } = await adminClient
    .from(TABLES.BOOKINGS)
    .select(`
      id,
      user_id,
      user_package_id,
      tokens_used,
      class:${TABLES.CLASSES}!inner(
        id,
        title,
        scheduled_at,
        duration_minutes
      )
    `)
    .eq('status', 'confirmed')
    .eq('is_trial_booking', false)
    .lt('class.scheduled_at', new Date().toISOString())

  if (error) {
    console.error('[AttendanceService] Failed to fetch bookings for completion processing:', error)
    return { processed: 0, failed: 0, errors: ['Failed to fetch bookings: ' + error.message] }
  }

  let processed = 0
  let failed = 0

  for (const booking of bookings || []) {
    const classData = (booking.class as unknown) as { id: string; title: string; scheduled_at: string; duration_minutes: number }
    const classEndTime = new Date(
      new Date(classData.scheduled_at).getTime() +
      classData.duration_minutes * 60 * 1000
    )
    const graceEndTime = new Date(classEndTime.getTime() + 30 * 60 * 1000)

    if (new Date() > graceEndTime) {
      try {
        await checkIn({
          bookingId: booking.id,
          method: 'auto',
          checkedInBy: 'system',
          notes: 'Auto-marked attended after class ended',
        })
        processed++
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[AttendanceService] Failed to mark booking ${booking.id} attended:`, err)
        errors.push(`Booking ${booking.id}: ${errorMsg}`)
        failed++
      }
    }
  }

  if (errors.length > 0) {
    console.error('[AttendanceService] Completed-booking processing had errors:', errors)
  }

  return { processed, failed, errors: errors.length > 0 ? errors : undefined }
}
