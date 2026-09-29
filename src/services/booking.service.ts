import { supabase, getSupabaseAdminClient, TABLES, isSupabaseError, SUPABASE_ERRORS } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import {
  chargeTokensForBooking,
  recordBookingCharges,
  refundBookingTokens,
  getUserTokenBalance,
} from './token.service'
import { canCancelWithRefund, SAME_DAY_CANCEL_MESSAGE } from '@/lib/cancellation-policy'
import type {
  Booking,
  BookingWithClass,
  CreateBookingRequest,
  CancelBookingRequest,
  BookingResponse,
  CancelBookingResponse,
} from '@/api/schemas'

interface CreateBookingParams {
  userId: string
  classId: string
}

interface CancelBookingParams {
  userId: string
  bookingId: string
  reason?: string
  /** Admin exception: cancel the individual booking and release its held tokens. */
  forceRefund?: boolean
}

async function sendMemberBookingStaffEmailNotifications(params: {
  userId: string
  classData: Record<string, unknown>
  tokensUsed: number
  bookingId?: string
  bookingNote?: string
}) {
  try {
    const { sendMemberBookingStaffEmailsViaApi, formatBookingDateTime } = await import('@/lib/member-booking-emails')
    const {
      isUserBookingConfirmationEmailEnabled,
    } = await import('@/lib/notification-preference-utils')
    const { getStaffAlertRecipients } = await import('@/lib/alert-email-recipients')

    const adminClient = getSupabaseAdminClient()

    const { data: userProfile } = await adminClient
      .from('user_profiles')
      .select('name, email, phone')
      .eq('id', params.userId)
      .single()

    const adminEmails = await getStaffAlertRecipients(adminClient)

    let instructorName = params.classData.instructor_name as string | undefined
    let tutorEmail: string | undefined

    if (params.classData.instructor_id) {
      const { data: instructor } = await adminClient
        .from('user_profiles')
        .select('name, email')
        .eq('id', params.classData.instructor_id as string)
        .single()

      instructorName = instructor?.name || instructorName
      tutorEmail = instructor?.email || undefined
    }

    if (tutorEmail) {
      const tutorWantsEmail = await isUserBookingConfirmationEmailEnabled(adminClient, tutorEmail)
      if (!tutorWantsEmail) {
        tutorEmail = undefined
      }
    }

    const { formattedDate, formattedTime } = formatBookingDateTime(params.classData.scheduled_at as string)

    await sendMemberBookingStaffEmailsViaApi(adminEmails, {
      memberName: userProfile?.name || 'Member',
      memberEmail: userProfile?.email || '',
      memberPhone: userProfile?.phone || undefined,
      className: params.classData.title as string,
      classDate: formattedDate,
      classTime: formattedTime,
      classLocation: (params.classData.location as string) || 'TBA',
      instructorName,
      tokensUsed: params.tokensUsed,
      bookingId: params.bookingId,
      bookingNote: params.bookingNote,
      tutorEmail,
    })
  } catch (error) {
    console.error('[Booking] Failed to send member booking staff emails:', error)
  }
}

// Create a booking (hold tokens)
export async function createBooking(params: CreateBookingParams): Promise<BookingResponse> {
  const { userId, classId } = params

  // 1. Check if class exists and has availability
  const { data: classData, error: classError } = await supabase
    .from(TABLES.CLASSES)
    .select('*')
    .eq('id', classId)
    .eq('status', 'scheduled')
    .single()

  if (classError || !classData) {
    throw new ApiError('NOT_FOUND_ERROR', 'Class not found or not available', 404)
  }

  // Validate class type matches user type (adult/kid restriction)
  // Note: Admins can bypass this check, but regular users cannot
  try {
    const { getUserType, isClassTypeCompatible } = await import('@/lib/user-age-utils')
    
    // Get user profile to check date of birth
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('date_of_birth')
      .eq('id', userId)
      .single()

    const userType = getUserType(userProfile?.date_of_birth)
    const classType = classData.class_type

    if (!isClassTypeCompatible(classType, userType)) {
      const userTypeLabel = userType === 'adult' ? 'adults' : 'children'
      const classTypeLabel = classType === 'adult' ? 'adult' : classType === 'kid' ? 'kids' : 'all'
      
      throw new ApiError(
        'VALIDATION_ERROR',
        `This class is for ${classTypeLabel} only. ${userTypeLabel === 'adults' ? 'Adults' : 'Children'} cannot book ${classTypeLabel} classes.`,
        400
      )
    }
  } catch (validationError) {
    // If it's an ApiError, rethrow it
    if (validationError instanceof ApiError) {
      throw validationError
    }
    console.error('[Booking Service] Error validating class type:', validationError)
    // Continue with booking if validation fails (fail open for backwards compatibility)
  }

  // Check if this is a course parent class (recurrence_type === 'course' && parent_class_id is null)
  const isCourseParent = classData.recurrence_type === 'course' && !classData.parent_class_id

  // For course bookings, we need to book all future sessions
  if (isCourseParent) {
    return await createCourseBooking(userId, classId, classData)
  }

  // Regular single/recurring class booking (existing logic)
  // Note: For recurring classes, users book individual sessions, not the entire series
  // Check if class is in the future
  if (new Date(classData.scheduled_at as string) <= new Date()) {
    throw new ApiError('VALIDATION_ERROR', 'Cannot book past classes', 400)
  }

  // Check capacity - count both confirmed and attended bookings
  const { count: bookedCount } = await supabase
    .from(TABLES.BOOKINGS)
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId)
    .in('status', ['confirmed', 'attended'])
  
  if ((bookedCount || 0) >= classData.capacity) {
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

  // 3. Charge tokens (spent at booking; refunded if cancelled by 23:59 the day before)
  const bookingId = crypto.randomUUID()

  const charge = await chargeTokensForBooking({
    userId,
    tokensNeeded: classData.token_cost,
    ageGroup: classData.age_group,
  })

  // 4. Create booking
  const { data: booking, error: bookingError } = await getSupabaseAdminClient()
    .from(TABLES.BOOKINGS)
    .insert({
      id: bookingId,
      user_id: userId,
      class_id: classId,
      user_package_id: charge.userPackageId,
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
    // Rollback: give the tokens back (no ledger row was written yet)
    await refundBookingTokens({
      userId,
      userPackageId: charge.userPackageId,
      bookingId: null,
      tokensToRefund: classData.token_cost,
      recordLedger: false,
    })

    if (isSupabaseError(bookingError, SUPABASE_ERRORS.UNIQUE_VIOLATION)) {
      throw new ApiError('CONFLICT_ERROR', 'You already have a booking for this class', 409)
    }
    throw new ApiError('SERVER_ERROR', 'Failed to create booking', 500, bookingError)
  }

  await recordBookingCharges({
    userId,
    userPackageId: charge.userPackageId,
    tokensBefore: charge.tokensBefore,
    charges: [{ bookingId, tokens: classData.token_cost, description: `Booked class: ${classData.title}` }],
  })

  // Send booking confirmation notification (in-app and email)
  try {
    const { sendNotification, sendBookingConfirmation } = await import('./notification.service')
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('name, email')
      .eq('id', userId)
      .single()

    const classDate = new Date(classData.scheduled_at as string)
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
      userId,
      type: 'booking_confirmation',
      channel: 'in_app',
      data: {
        user_name: userProfile?.name || 'User',
        class_title: classData.title,
        class_date: formattedDate,
        class_time: formattedTime,
        class_location: classData.location || 'TBA',
      },
    })

    // Send email notification via web app email API
    if (userProfile?.email && userProfile?.name) {
      try {
        const { getWebAppUrl } = await import('@/lib/email-url')
        const webAppUrl = getWebAppUrl()
        const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'
        
        // Get instructor name if available
        let instructorName: string | undefined
        if (classData.instructor_id) {
          const { data: instructor } = await supabase
            .from('user_profiles')
            .select('name')
            .eq('id', classData.instructor_id)
            .single()
          instructorName = instructor?.name
        }
        
        await fetch(`${webAppUrl}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'booking-confirmation',
            secret: emailApiSecret,
            data: {
              userEmail: userProfile.email,
              userName: userProfile.name,
              className: classData.title,
              classDate: formattedDate,
              classTime: formattedTime,
              classLocation: classData.location || 'TBA',
              tokensUsed: classData.token_cost,
              instructorName,
            },
          }),
        })
        console.log(`[Booking] Booking confirmation email sent to ${userProfile.email}`)
      } catch (emailError) {
        console.error(`[Booking] Failed to send booking confirmation email to ${userProfile.email}:`, emailError)
        // Don't fail booking if email fails
      }
    }

    // Send notification to the instructor/tutor
    if (classData.instructor_id) {
      await sendNotification({
        userId: classData.instructor_id,
        type: 'booking_confirmation',
        channel: 'in_app',
        data: {
          is_tutor_notification: true,
          student_name: userProfile?.name || 'A student',
          class_title: classData.title,
          class_date: formattedDate,
          class_time: formattedTime,
          message: `${userProfile?.name || 'A student'} has booked your class "${classData.title}" on ${formattedDate} at ${formattedTime}.`,
        },
      })
    }

    // Send notification to admins
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('id')
      .in('role', ['admin', 'super_admin'])

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await sendNotification({
          userId: admin.id,
          type: 'booking_confirmation',
          channel: 'in_app',
          data: {
            is_admin_notification: true,
            student_name: userProfile?.name || 'A student',
            class_title: classData.title,
            class_date: formattedDate,
            class_time: formattedTime,
            message: `New booking: ${userProfile?.name || 'A student'} booked "${classData.title}" on ${formattedDate} at ${formattedTime}.`,
          },
        })
      }
    }

    await sendMemberBookingStaffEmailNotifications({
      userId,
      classData,
      tokensUsed: classData.token_cost,
      bookingId: booking.id as string,
    })
  } catch (notificationError) {
    // Log but don't fail the booking if notification fails
    console.error('[Booking] Error sending confirmation notification:', notificationError)
  }

  const balance = await getUserTokenBalance(userId, getSupabaseAdminClient())

  return {
    booking: mapBookingToSchema(booking),
    tokensHeld: classData.token_cost,
    tokensAvailable: balance.availableTokens,
    message: `Successfully booked ${classData.title}. ${classData.token_cost} token(s) used.`,
  }
}

// Create bookings for an entire course (all future sessions)
async function createCourseBooking(
  userId: string,
  parentClassId: string,
  parentClassData: Record<string, unknown>
): Promise<BookingResponse> {
  const adminClient = getSupabaseAdminClient()
  const now = new Date()

  // 0. Validate class type matches user type (adult/kid restriction)
  try {
    const { getUserType, isClassTypeCompatible } = await import('@/lib/user-age-utils')
    
    // Get user profile to check date of birth
    const { data: userProfile } = await adminClient
      .from('user_profiles')
      .select('date_of_birth')
      .eq('id', userId)
      .single()

    const userType = getUserType(userProfile?.date_of_birth)
    const classType = parentClassData.class_type as string

    if (!isClassTypeCompatible(classType, userType)) {
      const userTypeLabel = userType === 'adult' ? 'adults' : 'children'
      const classTypeLabel = classType === 'adult' ? 'adult' : classType === 'kid' ? 'kids' : 'all'
      
      throw new ApiError(
        'VALIDATION_ERROR',
        `This course is for ${classTypeLabel} only. ${userTypeLabel === 'adults' ? 'Adults' : 'Children'} cannot book ${classTypeLabel} courses.`,
        400
      )
    }
  } catch (validationError) {
    // If it's an ApiError, rethrow it
    if (validationError instanceof ApiError) {
      throw validationError
    }
    console.error('[Booking Service] Error validating course class type:', validationError)
    // Continue with booking if validation fails (fail open for backwards compatibility)
  }

  // 1. Find all child instances (sessions) for this course
  const { data: allSessions, error: sessionsError } = await adminClient
    .from(TABLES.CLASSES)
    .select('*')
    .eq('parent_class_id', parentClassId)
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true })

  if (sessionsError) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch course sessions', 500, sessionsError)
  }

  if (!allSessions || allSessions.length === 0) {
    throw new ApiError('VALIDATION_ERROR', 'Course has no sessions available', 400)
  }

  // 2. Filter to only future sessions
  const futureSessions = allSessions.filter(session => {
    const sessionDate = new Date(session.scheduled_at)
    return sessionDate > now
  })

  if (futureSessions.length === 0) {
    throw new ApiError('VALIDATION_ERROR', 'Course has no future sessions available', 400)
  }

  // 3. Check if user already has bookings for any of these sessions
  const sessionIds = futureSessions.map(s => s.id)
  const { data: existingBookings } = await adminClient
    .from(TABLES.BOOKINGS)
    .select('class_id, class:classes(title)')
    .eq('user_id', userId)
    .in('class_id', sessionIds)
    .in('status', ['confirmed', 'waitlist'])

  if (existingBookings && existingBookings.length > 0) {
    const bookedSession = existingBookings[0]
    const sessionTitle = (bookedSession.class as any)?.title || 'a session'
    throw new ApiError('CONFLICT_ERROR', `You already have a booking for ${sessionTitle} in this course`, 409)
  }

  // 4. Check capacity for all sessions - count both confirmed and attended
  const { data: bookingCounts } = await adminClient
    .from(TABLES.BOOKINGS)
    .select('class_id')
    .in('class_id', sessionIds)
    .in('status', ['confirmed', 'attended'])

  // Count bookings per session
  const bookingsBySession: Record<string, number> = {}
  bookingCounts?.forEach(booking => {
    const id = booking.class_id as string
    bookingsBySession[id] = (bookingsBySession[id] || 0) + 1
  })

  // Check if any session is full
  for (const session of futureSessions) {
    const bookedCount = bookingsBySession[session.id] || 0
    if (bookedCount >= session.capacity) {
      throw new ApiError('VALIDATION_ERROR', `Session "${session.title}" is full. Cannot complete course booking.`, 400)
    }
  }

  // 5. Calculate total tokens needed (sessions × token cost per session)
  const tokenCostPerSession = parentClassData.token_cost as number || futureSessions[0]?.token_cost || 1
  const totalTokensNeeded = futureSessions.length * tokenCostPerSession

  // 6. Charge tokens for the entire course (one ledger row per session once bookings exist)
  const charge = await chargeTokensForBooking({
    userId,
    tokensNeeded: totalTokensNeeded,
    ageGroup: parentClassData.age_group as string | null,
  })

  // 7. Create bookings for all future sessions
  const bookingsToCreate = futureSessions.map(session => ({
    user_id: userId,
    class_id: session.id,
    user_package_id: charge.userPackageId,
    tokens_used: tokenCostPerSession,
    status: 'confirmed' as const,
    booked_at: new Date().toISOString(),
  }))

  const { data: createdBookings, error: bookingsError } = await adminClient
    .from(TABLES.BOOKINGS)
    .insert(bookingsToCreate)
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `)

  if (bookingsError || !createdBookings || createdBookings.length === 0) {
    // Rollback: give the tokens back (no ledger rows were written yet)
    await refundBookingTokens({
      userId,
      userPackageId: charge.userPackageId,
      bookingId: null,
      tokensToRefund: totalTokensNeeded,
      recordLedger: false,
    })

    if (bookingsError && isSupabaseError(bookingsError, SUPABASE_ERRORS.UNIQUE_VIOLATION)) {
      throw new ApiError('CONFLICT_ERROR', 'You already have a booking for one or more sessions in this course', 409)
    }
    throw new ApiError('SERVER_ERROR', 'Failed to create course bookings', 500, bookingsError)
  }

  await recordBookingCharges({
    userId,
    userPackageId: charge.userPackageId,
    tokensBefore: charge.tokensBefore,
    charges: createdBookings.map((b) => ({
      bookingId: b.id as string,
      tokens: tokenCostPerSession,
      description: `Booked course session: ${parentClassData.title}`,
    })),
  })

  // Return the first booking as the main booking (for API compatibility)
  const firstBooking = createdBookings[0]

  try {
    await sendMemberBookingStaffEmailNotifications({
      userId,
      classData: parentClassData,
      tokensUsed: totalTokensNeeded,
      bookingId: firstBooking.id as string,
      bookingNote: `${futureSessions.length} session${futureSessions.length !== 1 ? 's' : ''} booked`,
    })
  } catch (notificationError) {
    console.error('[Booking] Error sending course booking staff emails:', notificationError)
  }

  const balance = await getUserTokenBalance(userId, adminClient)

  return {
    booking: mapBookingToSchema(firstBooking),
    tokensHeld: totalTokensNeeded,
    tokensAvailable: balance.availableTokens,
    message: `Successfully enrolled in course "${parentClassData.title}". ${futureSessions.length} sessions booked. ${totalTokensNeeded} token(s) used.`,
  }
}

// Cancel a booking. Tokens were spent at booking time, so a cancellation made by
// 23:59 (Singapore) the day before the class refunds them; same-day cancellation is
// not allowed. Admins can always cancel with a refund (forceRefund).
export async function cancelBooking(params: CancelBookingParams): Promise<CancelBookingResponse> {
  const { userId, bookingId, reason, forceRefund = false } = params
  const adminClient = getSupabaseAdminClient()

  // 1. Get booking
  const { data: booking, error: fetchError } = await adminClient
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

  const classData = booking.class as Record<string, unknown>
  const isCourseSession = classData.parent_class_id && classData.recurrence_type === 'course'

  // Members cancelling a course session cancel every remaining session they can still cancel
  if (isCourseSession && !forceRefund) {
    return await cancelCourseBooking(userId, bookingId, classData.parent_class_id as string, reason)
  }

  // 2. Same-day (or past) cancellations are not allowed unless an admin forces a refund
  if (!forceRefund && !canCancelWithRefund(classData.scheduled_at as string)) {
    throw new ApiError('VALIDATION_ERROR', SAME_DAY_CANCEL_MESSAGE, 400)
  }

  // 3. Cancel + refund
  const [cancelled] = await cancelAndRefundBookings({
    userId,
    bookingIds: [bookingId],
    reason: reason || null,
    refundDescription: forceRefund
      ? `Admin cancellation with refund: ${reason || 'booking exception'}`
      : 'Cancelled by 23:59 the day before the class',
  })

  if (!cancelled) {
    throw new ApiError('CONFLICT_ERROR', 'This booking was already cancelled', 409)
  }

  const tokensRefunded = cancelled.tokensRefunded

  const { data: updatedBooking } = await adminClient
    .from(TABLES.BOOKINGS)
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `)
    .eq('id', bookingId)
    .single()

  await sendCancellationNotifications({ userId, classData, tokensRefunded, reason })
  await processWaitlists([classData.id as string])

  return {
    booking: mapBookingToSchema(updatedBooking!),
    tokensRefunded,
    penalty: false,
    message: `Booking cancelled. ${tokensRefunded} token(s) refunded.`,
  }
}

// Cancel a member's course: every remaining session dated tomorrow or later (Singapore)
// is cancelled and refunded; sessions happening today stay booked.
async function cancelCourseBooking(
  userId: string,
  bookingId: string,
  parentClassId: string,
  reason?: string
): Promise<CancelBookingResponse> {
  const adminClient = getSupabaseAdminClient()

  const { data: courseSessions, error: sessionsError } = await adminClient
    .from(TABLES.CLASSES)
    .select('id, scheduled_at')
    .eq('parent_class_id', parentClassId)
    .gt('scheduled_at', new Date().toISOString())

  if (sessionsError) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch course sessions', 500, sessionsError)
  }

  const cancellableSessionIds = (courseSessions || [])
    .filter((s) => canCancelWithRefund(s.scheduled_at as string))
    .map((s) => s.id as string)

  if (cancellableSessionIds.length === 0) {
    throw new ApiError('VALIDATION_ERROR', SAME_DAY_CANCEL_MESSAGE, 400)
  }

  const { data: userCourseBookings, error: bookingsError } = await adminClient
    .from(TABLES.BOOKINGS)
    .select('id, class_id')
    .eq('user_id', userId)
    .in('class_id', cancellableSessionIds)
    .eq('status', 'confirmed')

  if (bookingsError) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch course bookings', 500, bookingsError)
  }

  if (!userCourseBookings || userCourseBookings.length === 0) {
    throw new ApiError('VALIDATION_ERROR', SAME_DAY_CANCEL_MESSAGE, 400)
  }

  const cancelled = await cancelAndRefundBookings({
    userId,
    bookingIds: userCourseBookings.map((b) => b.id as string),
    reason: reason || 'Course cancellation',
    refundDescription: 'Course session cancelled by 23:59 the day before',
  })

  const tokensRefunded = cancelled.reduce((sum, b) => sum + b.tokensRefunded, 0)
  const keptToday = (courseSessions || []).length - cancellableSessionIds.length

  await processWaitlists(userCourseBookings.map((b) => b.class_id as string))

  const { data: updatedBooking } = await adminClient
    .from(TABLES.BOOKINGS)
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `)
    .eq('id', bookingId)
    .single()

  return {
    booking: mapBookingToSchema(updatedBooking!),
    tokensRefunded,
    penalty: false,
    message:
      `Course cancelled. ${tokensRefunded} token(s) refunded for ${cancelled.length} session(s).` +
      (keptToday > 0 ? ` ${keptToday} session(s) today stay booked.` : ''),
  }
}

// Mark confirmed bookings as cancelled, then refund each one's tokens.
// The status update only matches still-confirmed rows, so a booking can never be refunded twice.
export async function cancelAndRefundBookings(params: {
  userId?: string
  bookingIds: string[]
  reason: string | null
  refundDescription: string
  performedBy?: string
}): Promise<{ bookingId: string; tokensRefunded: number }[]> {
  const adminClient = getSupabaseAdminClient()
  const now = new Date().toISOString()

  let query = adminClient
    .from(TABLES.BOOKINGS)
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancellation_reason: params.reason,
      updated_at: now,
    })
    .in('id', params.bookingIds)
    .eq('status', 'confirmed')

  if (params.userId) {
    query = query.eq('user_id', params.userId)
  }

  const { data: claimed, error } = await query.select('id, user_id, user_package_id, tokens_used')

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to cancel booking', 500, error)
  }

  const results: { bookingId: string; tokensRefunded: number }[] = []
  const rows = claimed || []

  for (let i = 0; i < rows.length; i++) {
    const b = rows[i]
    const tokens = (b.tokens_used as number) || 0
    // Trial / paid bookings have no package and nothing to refund
    if (!b.user_package_id || tokens <= 0) {
      results.push({ bookingId: b.id as string, tokensRefunded: 0 })
      continue
    }

    try {
      await refundBookingTokens({
        userId: b.user_id as string,
        userPackageId: b.user_package_id as string,
        bookingId: b.id as string,
        tokensToRefund: tokens,
        description: params.refundDescription,
        performedBy: params.performedBy,
      })
      results.push({ bookingId: b.id as string, tokensRefunded: tokens })
    } catch (refundError) {
      // Put this and every not-yet-refunded booking back so the member keeps their places and can retry
      const unrefundedIds = rows.slice(i).map((r) => r.id as string)
      console.error(`[Booking] Refund failed for booking ${b.id}, restoring ${unrefundedIds.length} booking(s):`, refundError)
      await adminClient
        .from(TABLES.BOOKINGS)
        .update({ status: 'confirmed', cancelled_at: null, cancellation_reason: null, updated_at: new Date().toISOString() })
        .in('id', unrefundedIds)
      throw refundError
    }
  }

  return results
}

async function processWaitlists(classIds: string[]) {
  const { processWaitlistForClass } = await import('./waitlist.service')
  for (const classId of [...new Set(classIds)]) {
    try {
      await processWaitlistForClass(classId)
    } catch (waitlistError) {
      // Log but don't fail the cancellation if waitlist processing fails
      console.error(`[Booking] Error processing waitlist for class ${classId} after cancellation:`, waitlistError)
    }
  }
}

async function sendCancellationNotifications(params: {
  userId: string
  classData: Record<string, unknown>
  tokensRefunded: number
  reason?: string
}) {
  const { userId, classData, tokensRefunded, reason } = params
  const db = getSupabaseAdminClient()

  try {
    const { sendNotification } = await import('./notification.service')
    const { data: userProfile } = await db
      .from('user_profiles')
      .select('name, email')
      .eq('id', userId)
      .single()

    const classDate = new Date(classData.scheduled_at as string)
    const formattedDate = classDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const formattedTime = classDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    // In-app notification
    await sendNotification({
      userId,
      type: 'booking_cancelled',
      channel: 'in_app',
      data: {
        user_name: userProfile?.name || 'User',
        class_title: classData.title,
        tokens_refunded: tokensRefunded,
        penalty: false,
      },
    })

    // Email notification via web app API
    if (userProfile?.email && userProfile?.name) {
      const { getWebAppUrl } = await import('@/lib/email-url')
      const webAppUrl = getWebAppUrl()
      const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'

      await fetch(`${webAppUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'booking-cancellation',
          secret: emailApiSecret,
          data: {
            userEmail: userProfile.email,
            userName: userProfile.name,
            className: classData.title as string,
            classDate: formattedDate,
            classTime: formattedTime,
            tokensRefunded,
            penalty: false,
            reason: reason || undefined,
          },
        }),
      })
      console.log(`[BookingService] Cancellation email sent to ${userProfile.email}`)
    }

    // Notify the instructor/tutor about the cancellation
    if (classData.instructor_id) {
      await sendNotification({
        userId: classData.instructor_id as string,
        type: 'booking_cancelled',
        channel: 'in_app',
        data: {
          is_tutor_notification: true,
          student_name: userProfile?.name || 'A student',
          class_title: classData.title,
          class_date: formattedDate,
          class_time: formattedTime,
          message: `${userProfile?.name || 'A student'} has cancelled their booking for "${classData.title}" on ${formattedDate} at ${formattedTime}.`,
        },
      })
    }

    // Notify admins about the cancellation
    const { data: admins } = await db
      .from('user_profiles')
      .select('id')
      .in('role', ['admin', 'super_admin'])

    for (const admin of admins || []) {
      await sendNotification({
        userId: admin.id,
        type: 'booking_cancelled',
        channel: 'in_app',
        data: {
          is_admin_notification: true,
          student_name: userProfile?.name || 'A student',
          class_title: classData.title,
          class_date: formattedDate,
          penalty: false,
          message: `Booking cancelled: ${userProfile?.name || 'A student'} cancelled "${classData.title}" on ${formattedDate}.`,
        },
      })
    }
  } catch (notificationError) {
    console.error('[Booking] Error sending cancellation notification:', notificationError)
  }
}

// Batch booking - book multiple classes at once (all-or-nothing transaction)
interface BatchBookingParams {
  userId: string
  classIds: string[]
}

interface BatchBookingResult {
  success: boolean
  message: string
  bookings: Array<{
    classId: string
    bookingId?: string
    success: boolean
    message: string
  }>
  totalTokensHeld: number
}

export async function createBatchBooking(params: BatchBookingParams): Promise<BatchBookingResult> {
  const { userId, classIds } = params

  if (!classIds || classIds.length === 0) {
    throw new ApiError('VALIDATION_ERROR', 'At least one class ID is required', 400)
  }

  const adminClient = getSupabaseAdminClient()
  
  // 1. Fetch all class details
  const { data: classes, error: classError } = await supabase
    .from(TABLES.CLASSES)
    .select('*')
    .in('id', classIds)
    .eq('status', 'scheduled')

  if (classError || !classes || classes.length === 0) {
    throw new ApiError('NOT_FOUND_ERROR', 'One or more classes not found or not available', 404)
  }

  if (classes.length !== classIds.length) {
    throw new ApiError('NOT_FOUND_ERROR', 'One or more classes not found or not available', 404)
  }

  // 2. Validate all classes and check for existing bookings
  let totalTokensNeeded = 0
  const classMap = new Map(classes.map(c => [c.id, c]))
  const validationResults: string[] = []

  // Check if class is in the future
  for (const classData of classes) {
    if (new Date(classData.scheduled_at as string) <= new Date()) {
      validationResults.push(`Class "${classData.title}" is in the past`)
    }
    totalTokensNeeded += classData.token_cost
  }

  if (validationResults.length > 0) {
    throw new ApiError('VALIDATION_ERROR', `Cannot book: ${validationResults.join('; ')}`, 400)
  }

  // Check if user already has bookings for any of these classes
  const { data: existingBookings } = await supabase
    .from(TABLES.BOOKINGS)
    .select('class_id, class:classes(title)')
    .eq('user_id', userId)
    .in('class_id', classIds)
    .in('status', ['confirmed', 'waitlist'])

  if (existingBookings && existingBookings.length > 0) {
    const bookedClasses = existingBookings.map(b => (b.class as any)?.title || 'Unknown').join(', ')
    throw new ApiError('CONFLICT_ERROR', `You already have bookings for: ${bookedClasses}`, 409)
  }

  // Check capacity for all classes
  const { data: bookingCounts } = await supabase
    .from(TABLES.BOOKINGS)
    .select('class_id')
    .in('class_id', classIds)
    .in('status', ['confirmed', 'attended'])

  const bookingsByClass: Record<string, number> = {}
  bookingCounts?.forEach(booking => {
    const id = booking.class_id as string
    bookingsByClass[id] = (bookingsByClass[id] || 0) + 1
  })

  const fullClasses: string[] = []
  for (const classData of classes) {
    const bookedCount = bookingsByClass[classData.id] || 0
    if (bookedCount >= classData.capacity) {
      fullClasses.push(classData.title)
    }
  }

  if (fullClasses.length > 0) {
    throw new ApiError('VALIDATION_ERROR', `Full classes: ${fullClasses.join(', ')}. Cannot complete batch booking.`, 400)
  }

  // 3. Charge tokens for ALL classes from one package (all-or-nothing)
  const ageGroups = [...new Set(classes.map(c => (c.age_group as string) || 'all').filter(g => g !== 'all'))]
  if (ageGroups.length > 1) {
    throw new ApiError('VALIDATION_ERROR', 'Please book adult and kids classes separately.', 400)
  }

  const charge = await chargeTokensForBooking({
    userId,
    tokensNeeded: totalTokensNeeded,
    ageGroup: ageGroups[0] || 'all',
  })

  // 4. Create all bookings in a single insert
  const bookingsToInsert = classes.map(classData => ({
    user_id: userId,
    class_id: classData.id,
    user_package_id: charge.userPackageId,
    tokens_used: classData.token_cost,
    status: 'confirmed',
    booked_at: new Date().toISOString(),
  }))

  const { data: createdBookings, error: bookingError } = await adminClient
    .from(TABLES.BOOKINGS)
    .insert(bookingsToInsert)
    .select('*')

  if (bookingError || !createdBookings || createdBookings.length === 0) {
    // Rollback: give the tokens back (no ledger rows were written yet)
    await refundBookingTokens({
      userId,
      userPackageId: charge.userPackageId,
      bookingId: null,
      tokensToRefund: totalTokensNeeded,
      recordLedger: false,
    })

    throw new ApiError('SERVER_ERROR', 'Failed to create bookings', 500, bookingError)
  }

  await recordBookingCharges({
    userId,
    userPackageId: charge.userPackageId,
    tokensBefore: charge.tokensBefore,
    charges: createdBookings.map((b) => ({
      bookingId: b.id as string,
      tokens: b.tokens_used as number,
      description: `Booked class: ${classMap.get(b.class_id)?.title || 'class'}`,
    })),
  })

  // 5. Send notifications for all bookings
  try {
    const { sendNotification, sendBookingConfirmation } = await import('./notification.service')
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('name, email')
      .eq('id', userId)
      .single()

    // Send one notification for batch booking
    const classNames = classes.map(c => c.title).join(', ')
    await sendNotification({
      userId,
      type: 'booking_confirmation',
      channel: 'in_app',
      data: {
        user_name: userProfile?.name || 'User',
        class_titles: classNames,
        session_count: classes.length,
        total_tokens: totalTokensNeeded,
      },
    })

    // Send notifications to instructors and admins
    const instructorIds = new Set(classes.map(c => c.instructor_id).filter(Boolean))
    
    for (const instructorId of instructorIds) {
      if (instructorId) {
        await sendNotification({
          userId: instructorId,
          type: 'booking_confirmation',
          channel: 'in_app',
          data: {
            is_tutor_notification: true,
            student_name: userProfile?.name || 'A student',
            class_titles: classNames,
            session_count: classes.length,
            message: `${userProfile?.name || 'A student'} has booked ${classes.length} of your classes.`,
          },
        })
      }
    }

    // Notify admins
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('id')
      .in('role', ['admin', 'super_admin'])

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await sendNotification({
          userId: admin.id,
          type: 'booking_confirmation',
          channel: 'in_app',
          data: {
            is_admin_notification: true,
            student_name: userProfile?.name || 'A student',
            class_titles: classNames,
            session_count: classes.length,
            total_tokens: totalTokensNeeded,
            message: `${userProfile?.name || 'A student'} has batch booked ${classes.length} classes using ${totalTokensNeeded} token(s).`,
          },
        })
      }
    }

    for (const classData of classes) {
      const bookingRecord = createdBookings.find((booking) => booking.class_id === classData.id)
      await sendMemberBookingStaffEmailNotifications({
        userId,
        classData,
        tokensUsed: classData.token_cost,
        bookingId: bookingRecord?.id,
      })
    }
  } catch (notificationError) {
    console.error('Error sending notifications:', notificationError)
    // Don't throw - notifications are not critical
  }

  return {
    success: true,
    message: `Successfully booked ${classes.length} class${classes.length !== 1 ? 'es' : ''} using ${totalTokensNeeded} token${totalTokensNeeded !== 1 ? 's' : ''}`,
    bookings: createdBookings.map(booking => ({
      classId: booking.class_id,
      bookingId: booking.id,
      success: true,
      message: 'Booked successfully',
    })),
    totalTokensHeld: totalTokensNeeded,
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

  const adminClient = getSupabaseAdminClient()

  let query = adminClient
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
    ageGroup: (row.age_group as 'adult' | 'kid' | 'all') || 'all',
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
