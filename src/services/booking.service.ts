import { supabase, getSupabaseAdminClient, TABLES, isSupabaseError, SUPABASE_ERRORS } from '@/lib/supabase'
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
    .select('*')
    .eq('id', classId)
    .eq('status', 'scheduled')
    .single()

  if (classError || !classData) {
    throw new ApiError('NOT_FOUND_ERROR', 'Class not found or not available', 404)
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
    if (tokenResult.userPackageId) {
      await releaseTokens({
        userId,
        userPackageId: tokenResult.userPackageId,
        bookingId: '',
        tokensToRelease: classData.token_cost,
        description: 'Rollback: booking creation failed',
      })
    }

    if (isSupabaseError(bookingError, SUPABASE_ERRORS.UNIQUE_VIOLATION)) {
      throw new ApiError('CONFLICT_ERROR', 'You already have a booking for this class', 409)
    }
    throw new ApiError('SERVER_ERROR', 'Failed to create booking', 500, bookingError)
  }

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
  } catch (notificationError) {
    // Log but don't fail the booking if notification fails
    console.error('[Booking] Error sending confirmation notification:', notificationError)
  }

  return {
    booking: mapBookingToSchema(booking),
    tokensHeld: classData.token_cost,
    tokensAvailable: tokenResult.newBalance,
    message: `Successfully booked ${classData.title}. ${classData.token_cost} token(s) held.`,
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

  // 6. Hold tokens for the entire course
  const tokenResult = await holdTokens({
    userId,
    tokensNeeded: totalTokensNeeded,
    bookingId: '', // will be set after bookings created
    classType: parentClassData.class_type as string,
  })

  // 7. Create bookings for all future sessions
  const bookingsToCreate = futureSessions.map(session => ({
    user_id: userId,
    class_id: session.id,
    user_package_id: tokenResult.userPackageId,
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

  if (bookingsError) {
    // Rollback: release tokens
    if (tokenResult.userPackageId) {
      await releaseTokens({
        userId,
        userPackageId: tokenResult.userPackageId,
        bookingId: '',
        tokensToRelease: totalTokensNeeded,
        description: 'Rollback: course booking creation failed',
      })
    }

    if (isSupabaseError(bookingsError, SUPABASE_ERRORS.UNIQUE_VIOLATION)) {
      throw new ApiError('CONFLICT_ERROR', 'You already have a booking for one or more sessions in this course', 409)
    }
    throw new ApiError('SERVER_ERROR', 'Failed to create course bookings', 500, bookingsError)
  }

  // Return the first booking as the main booking (for API compatibility)
  const firstBooking = createdBookings?.[0]
  if (!firstBooking) {
    throw new ApiError('SERVER_ERROR', 'Failed to create course bookings', 500)
  }

  return {
    booking: mapBookingToSchema(firstBooking),
    tokensHeld: totalTokensNeeded,
    tokensAvailable: tokenResult.newBalance,
    message: `Successfully enrolled in course "${parentClassData.title}". ${futureSessions.length} sessions booked. ${totalTokensNeeded} token(s) held.`,
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

  // Check if this is part of a course (has parent_class_id and recurrence_type is 'course')
  const classData = booking.class as Record<string, unknown>
  const isCourseSession = classData.parent_class_id && classData.recurrence_type === 'course'

  // For course sessions, cancel all remaining sessions in the course
  if (isCourseSession) {
    return await cancelCourseBooking(userId, bookingId, booking, classData.parent_class_id as string, reason)
  }

  // 2. Check if within cancellation window (for single/recurring classes)
  const classTime = new Date(classData.scheduled_at as string)
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

  // 4. Send cancellation notification (in-app and email)
  try {
    const { sendNotification } = await import('./notification.service')
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('name, email')
      .eq('id', userId)
      .single()

    // In-app notification
    await sendNotification({
      userId,
      type: 'booking_cancelled',
      channel: 'in_app',
      data: {
        user_name: userProfile?.name || 'User',
        class_title: classData.title,
        tokens_refunded: tokensRefunded,
        penalty: isPenalty,
      },
    })

    // Email notification via web app API
    if (userProfile?.email && userProfile?.name) {
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
            penalty: isPenalty,
            reason: reason || undefined,
          },
        }),
      })
      console.log(`[BookingService] Cancellation email sent to ${userProfile.email}`)
    }

    // Notify the instructor/tutor about the cancellation
    if (classData.instructor_id) {
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
    const classDate = classData.instructor_id ? null : new Date(classData.scheduled_at as string)
    const formattedDateAdmin = classDate ? classDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) : new Date(classData.scheduled_at as string).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })

    const { data: admins } = await supabase
      .from('user_profiles')
      .select('id')
      .in('role', ['admin', 'super_admin'])

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await sendNotification({
          userId: admin.id,
          type: 'booking_cancelled',
          channel: 'in_app',
          data: {
            is_admin_notification: true,
            student_name: userProfile?.name || 'A student',
            class_title: classData.title,
            class_date: formattedDateAdmin,
            penalty: isPenalty,
            message: `Booking cancelled: ${userProfile?.name || 'A student'} cancelled "${classData.title}" on ${formattedDateAdmin}${isPenalty ? ' (late cancellation)' : ''}.`,
          },
        })
      }
    }
  } catch (notificationError) {
    console.error('[Booking] Error sending cancellation notification:', notificationError)
  }

  // 5. Process waitlist - notify next person when a spot opens
  const { processWaitlistForClass } = await import('./waitlist.service')
  try {
    await processWaitlistForClass(classData.id as string)
  } catch (waitlistError) {
    // Log but don't fail the cancellation if waitlist processing fails
    console.error('[Booking] Error processing waitlist after cancellation:', waitlistError)
  }

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

// Cancel all remaining course sessions
async function cancelCourseBooking(
  userId: string,
  bookingId: string,
  booking: Record<string, unknown>,
  parentClassId: string,
  reason?: string
): Promise<CancelBookingResponse> {
  const now = new Date()

  const adminClient = getSupabaseAdminClient()

  // Find all remaining future sessions for this course that the user has booked
  const { data: allCourseSessions, error: sessionsError } = await adminClient
    .from(TABLES.CLASSES)
    .select('id, scheduled_at, token_cost')
    .eq('parent_class_id', parentClassId)
    .eq('status', 'scheduled')
    .gt('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })

  if (sessionsError) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch course sessions', 500, sessionsError)
  }

  // Get all user's bookings for these future sessions
  const sessionIds = allCourseSessions?.map(s => s.id) || []
  if (sessionIds.length === 0) {
    // No future sessions, just cancel this one
    return await cancelSingleBooking(userId, bookingId, booking, reason)
  }

  const { data: userCourseBookings, error: bookingsError } = await adminClient
    .from(TABLES.BOOKINGS)
    .select('id, tokens_used, class_id, class:classes(scheduled_at)')
    .eq('user_id', userId)
    .in('class_id', sessionIds)
    .eq('status', 'confirmed')

  if (bookingsError) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch course bookings', 500, bookingsError)
  }

  if (!userCourseBookings || userCourseBookings.length === 0) {
    // No other bookings found, just cancel this one
    return await cancelSingleBooking(userId, bookingId, booking, reason)
  }

  // Calculate total tokens to refund (all future sessions)
  const totalTokensToRefund = userCourseBookings.reduce((sum, b) => sum + (b.tokens_used || 0), 0)
  const bookingIds = userCourseBookings.map(b => b.id)

  // Check cancellation window for the earliest session
  const earliestBooking = userCourseBookings[0]
  const earliestClassTime = new Date((earliestBooking.class as any)?.scheduled_at || earliestBooking.class_id)
  const hoursUntilEarliest = (earliestClassTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  const isWithinWindow = hoursUntilEarliest >= CANCELLATION_WINDOW_HOURS
  const isPenalty = !isWithinWindow && hoursUntilEarliest > 0

  let tokensRefunded = 0
  let newStatus: 'cancelled' | 'cancelled-late' = 'cancelled'

  if (isWithinWindow) {
    // Free cancellation - release all tokens
    tokensRefunded = totalTokensToRefund
    newStatus = 'cancelled'

    // Release tokens for all bookings (they should all use the same package)
    for (const b of userCourseBookings) {
      await releaseTokens({
        userId,
        userPackageId: booking.user_package_id as string,
        bookingId: b.id,
        tokensToRelease: b.tokens_used || 0,
        description: `Course cancelled within ${CANCELLATION_WINDOW_HOURS}h window`,
      })
    }
  } else if (isPenalty) {
    // Late cancellation - consume tokens as penalty
    tokensRefunded = 0
    newStatus = 'cancelled-late'

    // Consume tokens for all bookings
    for (const b of userCourseBookings) {
      await consumeTokens({
        userId,
        userPackageId: booking.user_package_id as string,
        bookingId: b.id,
        tokensToConsume: b.tokens_used || 0,
        transactionType: 'late-cancel-consume',
        description: `Course late cancellation penalty (within ${CANCELLATION_WINDOW_HOURS}h of first session)`,
      })
    }
  } else {
    // Course already started
    throw new ApiError('VALIDATION_ERROR', 'Cannot cancel course after it has started', 400)
  }

  // Update all bookings
  const { error: updateError } = await adminClient
    .from(TABLES.BOOKINGS)
    .update({
      status: newStatus,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || 'Course cancellation',
      updated_at: new Date().toISOString(),
    })
    .in('id', bookingIds)

  if (updateError) {
    throw new ApiError('SERVER_ERROR', 'Failed to cancel course bookings', 500, updateError)
  }

  // Process waitlist for all cancelled sessions
  const { processWaitlistForClass } = await import('./waitlist.service')
  const uniqueClassIds = [...new Set(userCourseBookings.map(b => b.class_id as string))]
  for (const sessionClassId of uniqueClassIds) {
    try {
      await processWaitlistForClass(sessionClassId)
    } catch (waitlistError) {
      // Log but don't fail the cancellation if waitlist processing fails
      console.error(`[Booking] Error processing waitlist for session ${sessionClassId} after cancellation:`, waitlistError)
    }
  }

  // Get the updated booking for return
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
    penalty: isPenalty,
    penaltyReason: isPenalty ? `Cancelled less than ${CANCELLATION_WINDOW_HOURS} hours before course start` : undefined,
    message: isPenalty
      ? `Course cancelled. ${totalTokensToRefund} token(s) consumed as late cancellation penalty.`
      : `Course cancelled. ${tokensRefunded} token(s) refunded for ${userCourseBookings.length} remaining session(s).`,
  }
}

// Helper to cancel a single booking
async function cancelSingleBooking(
  userId: string,
  bookingId: string,
  booking: Record<string, unknown>,
  reason?: string
): Promise<CancelBookingResponse> {
  const classData = booking.class as Record<string, unknown>
  const classTime = new Date(classData.scheduled_at as string)
  const now = new Date()
  const hoursUntilClass = (classTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  const isWithinWindow = hoursUntilClass >= CANCELLATION_WINDOW_HOURS
  const isPenalty = !isWithinWindow && hoursUntilClass > 0

  let newStatus: 'cancelled' | 'cancelled-late'
  let tokensRefunded = 0

  if (isWithinWindow) {
    newStatus = 'cancelled'
    tokensRefunded = booking.tokens_used as number
    await releaseTokens({
      userId,
      userPackageId: booking.user_package_id as string,
      bookingId,
      tokensToRelease: booking.tokens_used as number,
      description: `Cancelled within ${CANCELLATION_WINDOW_HOURS}h window`,
    })
  } else if (isPenalty) {
    newStatus = 'cancelled-late'
    tokensRefunded = 0
    await consumeTokens({
      userId,
      userPackageId: booking.user_package_id as string,
      bookingId,
      tokensToConsume: booking.tokens_used as number,
      transactionType: 'late-cancel-consume',
      description: `Late cancellation penalty (within ${CANCELLATION_WINDOW_HOURS}h of class)`,
    })
  } else {
    throw new ApiError('VALIDATION_ERROR', 'Cannot cancel after class has started', 400)
  }

  const adminClient = getSupabaseAdminClient()
  const { data: updatedBooking, error: updateError } = await adminClient
    .from(TABLES.BOOKINGS)
    .update({
      status: newStatus,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `)
    .single()

  if (updateError) {
    throw new ApiError('SERVER_ERROR', 'Failed to cancel booking', 500, updateError)
  }

  // Process waitlist - notify next person when a spot opens
  const { processWaitlistForClass } = await import('./waitlist.service')
  try {
    await processWaitlistForClass(classData.id as string)
  } catch (waitlistError) {
    // Log but don't fail the cancellation if waitlist processing fails
    console.error('[Booking] Error processing waitlist after cancellation:', waitlistError)
  }

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

  // 3. Hold tokens for ALL classes (all-or-nothing)
  const tokenResult = await holdTokens({
    userId,
    tokensNeeded: totalTokensNeeded,
    bookingId: '', // will be set after bookings created
    classType: 'batch',
  })

  try {
    // 4. Create all bookings in a single transaction
    const bookingsToInsert = classes.map(classData => ({
      user_id: userId,
      class_id: classData.id,
      user_package_id: tokenResult.userPackageId,
      tokens_used: classData.token_cost,
      status: 'confirmed',
      booked_at: new Date().toISOString(),
    }))

    const { data: createdBookings, error: bookingError } = await adminClient
      .from(TABLES.BOOKINGS)
      .insert(bookingsToInsert)
      .select('*')

    if (bookingError || !createdBookings) {
      // Rollback: release tokens
      if (tokenResult.userPackageId) {
        await releaseTokens({
          userId,
          userPackageId: tokenResult.userPackageId,
          bookingId: '',
          tokensToRelease: totalTokensNeeded,
          description: 'Rollback: batch booking creation failed',
        })
      }

      throw new ApiError('SERVER_ERROR', 'Failed to create bookings', 500, bookingError)
    }

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
  } catch (error) {
    // Rollback: release tokens on any error
    if (tokenResult.userPackageId) {
      await releaseTokens({
        userId,
        userPackageId: tokenResult.userPackageId,
        bookingId: '',
        tokensToRelease: totalTokensNeeded,
        description: 'Rollback: batch booking failed',
      })
    }
    throw error
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
