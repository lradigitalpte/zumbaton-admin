// Class Service
// Handles CRUD operations for fitness classes

import { supabase, getSupabaseAdminClient, TABLES, isSupabaseError, SUPABASE_ERRORS } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import type {
  Class,
  ClassWithAvailability,
  CreateClassRequest,
  UpdateClassRequest,
  ClassResponse,
  ClassListResponse,
  ClassListQuery,
  ClassAttendeesResponse,
} from '@/api/schemas'

// Helper function to generate class occurrences based on recurrence pattern
// maxWeeks parameter limits how many weeks to generate (for hybrid auto-generation)
function generateOccurrences(
  startDate: Date,
  recurrenceType: 'single' | 'recurring' | 'course',
  recurrencePattern?: Record<string, unknown>,
  maxWeeks?: number // If provided, limit recurring classes to this many weeks
): Date[] {
  const occurrences: Date[] = [new Date(startDate)]

  if (recurrenceType === 'single') {
    // Single class: just one occurrence, expires after class date (handled by status)
    return occurrences
  }

  if (!recurrencePattern) {
    return occurrences
  }

  const days = (recurrencePattern.days as string[]) || []
  const endDate = recurrencePattern.endDate 
    ? new Date(recurrencePattern.endDate as string)
    : null
  const occurrencesCount = (recurrencePattern.occurrences as number) || null

  // Preserve the original time
  const originalHours = startDate.getHours()
  const originalMinutes = startDate.getMinutes()
  const originalSeconds = startDate.getSeconds()

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayIndices = days.map(day => dayNames.indexOf(day.toLowerCase())).filter(idx => idx !== -1)

  if (dayIndices.length === 0) {
    return occurrences
  }

  if (recurrenceType === 'course' && occurrencesCount) {
    // Course: Fixed number of sessions (generate all)
    let currentDate = new Date(startDate)
    let sessionCount = 1

    while (sessionCount < occurrencesCount) {
      const currentDay = currentDate.getDay()
      const nextDayIndex = dayIndices.find(idx => idx > currentDay) || dayIndices[0]
      
      let daysToAdd: number
      if (nextDayIndex > currentDay) {
        daysToAdd = nextDayIndex - currentDay
      } else {
        // Next week
        daysToAdd = 7 - currentDay + nextDayIndex
      }

      currentDate = new Date(currentDate)
      currentDate.setDate(currentDate.getDate() + daysToAdd)
      currentDate.setHours(originalHours, originalMinutes, originalSeconds, 0)

      occurrences.push(new Date(currentDate))
      sessionCount++
    }
  } else if (recurrenceType === 'recurring') {
    // Recurring: Generate up to maxWeeks (default 8 weeks for hybrid auto-generation)
    let currentDate = new Date(startDate)
    const weeksToGenerate = maxWeeks || 8 // Default to 8 weeks
    const calculatedEndDate = new Date(startDate)
    calculatedEndDate.setDate(calculatedEndDate.getDate() + (weeksToGenerate * 7))
    
    // Use the earlier of: provided endDate or calculated maxWeeks limit
    const effectiveEndDate = endDate && endDate < calculatedEndDate ? endDate : calculatedEndDate
    
    const maxOccurrences = 200 // Safety limit

    for (let i = 0; i < maxOccurrences; i++) {
      const currentDay = currentDate.getDay()
      const nextDayIndex = dayIndices.find(idx => idx > currentDay) || dayIndices[0]
      
      let daysToAdd: number
      if (nextDayIndex > currentDay) {
        daysToAdd = nextDayIndex - currentDay
      } else {
        daysToAdd = 7 - currentDay + nextDayIndex
      }

      currentDate = new Date(currentDate)
      currentDate.setDate(currentDate.getDate() + daysToAdd)
      currentDate.setHours(originalHours, originalMinutes, originalSeconds, 0)

      if (currentDate > effectiveEndDate) {
        break
      }

      occurrences.push(new Date(currentDate))
    }
  }

  return occurrences
}

// Create a new class (admin only)
export async function createClass(data: CreateClassRequest & {
  roomId?: string;
  categoryId?: string;
  recurrenceType?: 'single' | 'recurring' | 'course';
  recurrencePattern?: Record<string, unknown>;
  allowDropIn?: boolean;
  dropInTokenCost?: number;
}): Promise<ClassResponse> {
  // Use admin client to bypass RLS for admin operations
  const adminClient = getSupabaseAdminClient()
  
  // Validate scheduled time is in the future
  if (new Date(data.scheduledAt) <= new Date()) {
    throw new ApiError('VALIDATION_ERROR', 'Class must be scheduled in the future', 400)
  }

  // Get instructor names - handle both single and multiple instructors
  let instructorName: string | null = null
  let primaryInstructorId: string | null = null
  
  // Handle multiple instructors (instructorIds takes precedence)
  if (data.instructorIds && data.instructorIds.length > 0) {
    const { data: instructors } = await adminClient
      .from('user_profiles')
      .select('id, name')
      .in('id', data.instructorIds)
    
    if (instructors && instructors.length > 0) {
      // Store comma-separated names
      instructorName = instructors.map(i => i.name).join(', ')
      // Use first instructor as primary for backward compatibility
      primaryInstructorId = instructors[0].id
    }
  } else if (data.instructorId) {
    // Single instructor (backward compatibility)
    const { data: instructor } = await adminClient
      .from('user_profiles')
      .select('name')
      .eq('id', data.instructorId)
      .single()
    instructorName = instructor?.name || null
    primaryInstructorId = data.instructorId
  }

  const recurrenceType = data.recurrenceType || 'single'
  const startDate = new Date(data.scheduledAt)

  // Validate required fields
  if (!data.title || !data.classType || !data.capacity) {
    throw new ApiError('VALIDATION_ERROR', 'Title, class type, and capacity are required', 400)
  }

  // Generate all occurrences
  const occurrences = generateOccurrences(startDate, recurrenceType, data.recurrencePattern)

  // Base class data
  const baseClassData = {
    title: data.title,
    description: data.description || null,
    class_type: data.classType,
    level: data.level || 'all_levels',
    age_group: data.ageGroup ?? 'all', // Target audience: adult, kid, or all (use ?? instead of || to allow 'kid'/'adult')
    instructor_id: primaryInstructorId, // Primary instructor (first one for backward compatibility)
    instructor_name: instructorName, // Comma-separated names for multiple instructors
    duration_minutes: data.durationMinutes || 60,
    capacity: data.capacity,
    token_cost: data.tokenCost || 1,
    location: data.location || null,
    room_id: data.roomId || null,
    category_id: data.categoryId || null,
    recurrence_type: recurrenceType,
    recurrence_pattern: data.recurrencePattern ? JSON.stringify(data.recurrencePattern) : null,
    status: 'scheduled' as const,
    // Walk-in/drop-in settings (requires migration 005_add_drop_in_to_classes.sql)
    allow_drop_in: data.allowDropIn || false,
    drop_in_token_cost: data.dropInTokenCost || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // For single classes, create just one occurrence
  if (recurrenceType === 'single') {
    const { data: classData, error } = await adminClient
      .from(TABLES.CLASSES)
      .insert({
        ...baseClassData,
        scheduled_at: startDate.toISOString(),
        parent_class_id: null,
        occurrence_date: startDate.toISOString().split('T')[0],
      })
      .select()
      .single()

    if (error) {
      throw new ApiError('SERVER_ERROR', 'Failed to create class', 500, error)
    }

    return {
      class: {
        ...mapClassToSchema(classData),
        bookedCount: 0,
        spotsRemaining: data.capacity,
        waitlistCount: 0,
        isBookable: true,
      },
    }
  }

  // For recurring and course classes, create parent class and all occurrences
  // First create the parent/template class (this is just a template, not an actual occurrence)
  // Set scheduled_at to a far future date so it never appears in date-based queries
  const templateDate = new Date('2099-12-31T00:00:00Z')
  const parentClassData = {
    ...baseClassData,
    scheduled_at: templateDate.toISOString(), // Far future date so parent never shows in daily queries
    parent_class_id: null,
    occurrence_date: null,
  }

  console.log('[createClass] Creating parent class with data:', {
    title: parentClassData.title,
    class_type: parentClassData.class_type,
    instructor_id: parentClassData.instructor_id,
    recurrence_type: parentClassData.recurrence_type,
    scheduled_at: parentClassData.scheduled_at,
  })

  const { data: parentClass, error: parentError } = await adminClient
    .from(TABLES.CLASSES)
    .insert(parentClassData)
    .select()
    .single()

  if (parentError) {
    console.error('[createClass] Failed to create parent class:', {
      error: parentError,
      errorCode: parentError.code,
      errorMessage: parentError.message,
      errorDetails: parentError.details,
      baseClassData: {
        title: baseClassData.title,
        class_type: baseClassData.class_type,
        instructor_id: baseClassData.instructor_id,
        capacity: baseClassData.capacity,
        scheduled_at: startDate.toISOString(),
      },
      recurrenceType,
    })
    throw new ApiError('SERVER_ERROR', `Failed to create parent class: ${parentError.message || 'Unknown error'}`, 500, parentError)
  }

  // Create ALL occurrence classes including the first one
  // Each occurrence should have the same token_cost from baseClassData
  const occurrenceClasses = occurrences.map(occurrenceDate => ({
    ...baseClassData,
    title: `${data.title} - ${occurrenceDate.toLocaleDateString()}`,
    scheduled_at: occurrenceDate.toISOString(),
    parent_class_id: parentClass.id,
    occurrence_date: occurrenceDate.toISOString().split('T')[0],
    // Explicitly set token_cost to ensure it's not overridden by defaults
    token_cost: data.tokenCost || 1,
  }))

  if (occurrenceClasses.length > 0) {
    const { error: occurrencesError } = await adminClient
      .from(TABLES.CLASSES)
      .insert(occurrenceClasses)

    if (occurrencesError) {
      // Clean up parent class if occurrences fail
      await adminClient.from(TABLES.CLASSES).delete().eq('id', parentClass.id)
      throw new ApiError('SERVER_ERROR', 'Failed to create class occurrences', 500, occurrencesError)
    }
  }

  // Return the parent class with availability info
  return {
    class: {
      ...mapClassToSchema(parentClass),
      bookedCount: 0,
      spotsRemaining: data.capacity,
      waitlistCount: 0,
      isBookable: true,
    },
  }
}

// Get a single class by ID with availability
export async function getClass(classId: string): Promise<ClassResponse> {
  const { data: classData, error } = await supabase
    .from(TABLES.CLASSES)
    .select('*')
    .eq('id', classId)
    .single()

  if (error || !classData) {
    throw new ApiError('NOT_FOUND_ERROR', 'Class not found', 404)
  }

  // Get booking count (count both confirmed and attended as enrolled)
  // Use admin client to bypass RLS and read all bookings
  const adminClient = getSupabaseAdminClient()
  const { count: bookedCount } = await adminClient
    .from(TABLES.BOOKINGS)
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId)
    .in('status', ['confirmed', 'attended'])

  // Get waitlist count
  const { count: waitlistCount } = await supabase
    .from(TABLES.WAITLIST)
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('status', 'waiting')

  const booked = bookedCount || 0
  const spotsRemaining = classData.capacity - booked
  const isBookable = classData.status === 'scheduled' &&
    new Date(classData.scheduled_at) > new Date() &&
    spotsRemaining > 0

  return {
    class: {
      ...mapClassToSchema(classData),
      bookedCount: booked,
      spotsRemaining,
      waitlistCount: waitlistCount || 0,
      isBookable,
    },
  }
}

// List classes with filtering and pagination
export async function listClasses(query: ClassListQuery): Promise<ClassListResponse> {
  const {
    page = 1,
    pageSize = 20,
    startDate,
    endDate,
    classType,
    level,
    instructorId,
    status,
  } = query

  let dbQuery = supabase
    .from(TABLES.CLASSES)
    .select('*', { count: 'exact' })
    .order('scheduled_at', { ascending: true })

  if (startDate) {
    dbQuery = dbQuery.gte('scheduled_at', startDate)
  }

  if (endDate) {
    dbQuery = dbQuery.lte('scheduled_at', endDate)
  }

  if (classType) {
    dbQuery = dbQuery.eq('class_type', classType)
  }

  if (level) {
    dbQuery = dbQuery.eq('level', level)
  }

  if (instructorId) {
    dbQuery = dbQuery.eq('instructor_id', instructorId)
  }

  if (status) {
    dbQuery = dbQuery.eq('status', status)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  dbQuery = dbQuery.range(from, to)

  const { data, error, count } = await dbQuery

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch classes', 500, error)
  }

  // Get ALL classes for stats calculation (without pagination)
  const { data: allClassesData } = await supabase
    .from(TABLES.CLASSES)
    .select('id, status, scheduled_at, duration_minutes, capacity')
    .order('scheduled_at', { ascending: true })

  // Calculate stats from ALL classes
  const now = new Date()
  let stats = {
    total: count || 0,
    active: 0,
    completed: 0,
    cancelled: 0,
    full: 0,
  }

  if (allClassesData) {
    // Get booking counts for all classes to determine "full" status
    const allClassIds = allClassesData.map((c: Record<string, unknown>) => c.id as string)
    const allBookingCounts = await getBookingCounts(allClassIds)

    allClassesData.forEach((classData: Record<string, unknown>) => {
      const id = classData.id as string
      const status = classData.status as string
      const scheduledAt = classData.scheduled_at as string
      const durationMinutes = (classData.duration_minutes as number) || 60
      const capacity = classData.capacity as number
      const bookedCount = allBookingCounts[id] || 0

      if (status === 'cancelled') {
        stats.cancelled++
      } else if (status === 'completed') {
        stats.completed++
      } else {
        // Check if class end time has passed (client-side logic for "completed")
        const classDate = new Date(scheduledAt)
        const classEndTime = new Date(classDate.getTime() + durationMinutes * 60 * 1000)
        
        if (classEndTime < now && status === 'scheduled') {
          stats.completed++
        } else if (bookedCount >= capacity) {
          stats.full++
        } else {
          stats.active++
        }
      }
    })
  }

  // Get booking counts for paginated classes
  const classIds = (data || []).map((c: Record<string, unknown>) => c.id as string)
  const bookingCounts = await getBookingCounts(classIds)
  const waitlistCounts = await getWaitlistCounts(classIds)

  const classesWithAvailability = (data || []).map((classData: Record<string, unknown>) => {
    const id = classData.id as string
    const capacity = classData.capacity as number
    const bookedCount = bookingCounts[id] || 0
    const spotsRemaining = capacity - bookedCount
    const isBookable = classData.status === 'scheduled' &&
      new Date(classData.scheduled_at as string) > new Date() &&
      spotsRemaining > 0

    return {
      ...mapClassToSchema(classData),
      bookedCount,
      spotsRemaining,
      waitlistCount: waitlistCounts[id] || 0,
      isBookable,
    }
  })

  return {
    classes: classesWithAvailability,
    total: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > page * pageSize,
    stats, // Include aggregated stats
  }
}

// Update a class (admin only)
export async function updateClass(
  classId: string,
  data: UpdateClassRequest
): Promise<ClassResponse> {
  // Use admin client to bypass RLS for admin operations
  const adminClient = getSupabaseAdminClient()
  
  // Get current class
  const { data: currentClass, error: fetchError } = await adminClient
    .from(TABLES.CLASSES)
    .select('*')
    .eq('id', classId)
    .single()

  if (fetchError || !currentClass) {
    throw new ApiError('NOT_FOUND_ERROR', 'Class not found', 404)
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.classType !== undefined) updateData.class_type = data.classType
  if (data.level !== undefined) updateData.level = data.level
  if (data.ageGroup !== undefined) updateData.age_group = data.ageGroup
  if (data.scheduledAt !== undefined) updateData.scheduled_at = data.scheduledAt
  if (data.durationMinutes !== undefined) updateData.duration_minutes = data.durationMinutes
  if (data.capacity !== undefined) updateData.capacity = data.capacity
  if (data.tokenCost !== undefined) updateData.token_cost = data.tokenCost
  if (data.location !== undefined) updateData.location = data.location
  if (data.status !== undefined) updateData.status = data.status
  if (data.roomId !== undefined) updateData.room_id = data.roomId
  if (data.categoryId !== undefined) updateData.category_id = data.categoryId
  if (data.recurrenceType !== undefined) updateData.recurrence_type = data.recurrenceType
  if (data.recurrencePattern !== undefined) updateData.recurrence_pattern = data.recurrencePattern
  if (data.allowDropIn !== undefined) updateData.allow_drop_in = data.allowDropIn
  if (data.dropInTokenCost !== undefined) updateData.drop_in_token_cost = data.dropInTokenCost

  // Handle instructor update
    // Handle multiple instructors (instructorIds takes precedence over instructorId)
    if (data.instructorIds !== undefined && data.instructorIds.length > 0) {
      const { data: instructors } = await adminClient
        .from('user_profiles')
        .select('id, name')
        .in('id', data.instructorIds)
      
      if (instructors && instructors.length > 0) {
        updateData.instructor_name = instructors.map(i => i.name).join(', ')
        updateData.instructor_id = instructors[0].id // Primary instructor
      }
    } else if (data.instructorId !== undefined) {
      // Single instructor (backward compatibility)
    updateData.instructor_id = data.instructorId
    if (data.instructorId) {
      const { data: instructor } = await adminClient
        .from('user_profiles')
        .select('name')
        .eq('id', data.instructorId)
        .single()
      updateData.instructor_name = instructor?.name || null
    } else {
      updateData.instructor_name = null
    }
  }

  // Check if this is a parent class (recurring or course)
  const isParentClass = !currentClass.parent_class_id && 
    (currentClass.recurrence_type === 'recurring' || currentClass.recurrence_type === 'course')
  
  // Check if this is an individual instance
  const isIndividualInstance = currentClass.parent_class_id !== null

  // Update the main class
  const { data: classData, error } = await adminClient
    .from(TABLES.CLASSES)
    .update(updateData)
    .eq('id', classId)
    .select()
    .single()

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to update class', 500, error)
  }

  // If updating a parent class, also update all child instances
  // Only update fields that should be consistent across the series
  if (isParentClass) {
    const childUpdateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Fields that should be updated across all instances
    if (data.tokenCost !== undefined) childUpdateData.token_cost = data.tokenCost
    if (data.capacity !== undefined) childUpdateData.capacity = data.capacity
    if (data.durationMinutes !== undefined) childUpdateData.duration_minutes = data.durationMinutes
    if (data.level !== undefined) childUpdateData.level = data.level
    if (data.classType !== undefined) childUpdateData.class_type = data.classType
    if (data.level !== undefined) childUpdateData.level = data.level
    if (data.ageGroup !== undefined) childUpdateData.age_group = data.ageGroup
    if (data.description !== undefined) childUpdateData.description = data.description
    if (data.location !== undefined) childUpdateData.location = data.location
    if (data.roomId !== undefined) childUpdateData.room_id = data.roomId
    if (data.categoryId !== undefined) childUpdateData.category_id = data.categoryId
    if (data.allowDropIn !== undefined) childUpdateData.allow_drop_in = data.allowDropIn
    if (data.dropInTokenCost !== undefined) childUpdateData.drop_in_token_cost = data.dropInTokenCost

    // Handle instructor update for children
    if (data.instructorId !== undefined) {
      childUpdateData.instructor_id = data.instructorId
      childUpdateData.instructor_name = updateData.instructor_name
    }

    // Update all child instances
    if (Object.keys(childUpdateData).length > 1) { // More than just updated_at
      const { error: childUpdateError } = await adminClient
        .from(TABLES.CLASSES)
        .update(childUpdateData)
        .eq('parent_class_id', classId)

      if (childUpdateError) {
        console.error('Failed to update child instances:', childUpdateError)
        // Don't throw - parent update succeeded, child updates are best effort
      }
    }
  }

  // Get updated availability
  return getClass(classId)
}

// Cancel a class (admin only)
export async function cancelClass(classId: string): Promise<{
  success: boolean
  message: string
  refundedBookings: number
}> {
  // Use admin client to bypass RLS for admin operations
  const adminClient = getSupabaseAdminClient()
  
  // Get class
  const { data: classData, error: fetchError } = await adminClient
    .from(TABLES.CLASSES)
    .select('*')
    .eq('id', classId)
    .single()

  if (fetchError || !classData) {
    throw new ApiError('NOT_FOUND_ERROR', 'Class not found', 404)
  }

  if (classData.status === 'cancelled') {
    throw new ApiError('VALIDATION_ERROR', 'Class is already cancelled', 400)
  }

  // Update class status
  const { error: updateError } = await adminClient
    .from(TABLES.CLASSES)
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', classId)

  if (updateError) {
    throw new ApiError('SERVER_ERROR', 'Failed to cancel class', 500, updateError)
  }

  // Get all confirmed bookings for this class
  const { data: bookings } = await adminClient
    .from(TABLES.BOOKINGS)
    .select('id, user_id, user_package_id, tokens_used')
    .eq('class_id', classId)
    .eq('status', 'confirmed')

  let refundedBookings = 0

  // Refund tokens for each booking
  // Note: This would normally use the token service, but we're keeping it simple here
  // In production, you'd want to use a transaction
  for (const booking of bookings || []) {
    try {
      // Release held tokens
      await adminClient
        .from(TABLES.USER_PACKAGES)
        .update({
          tokens_held: adminClient.rpc('decrement_tokens_held', {
            pkg_id: booking.user_package_id,
            amount: booking.tokens_used,
          }),
        })
        .eq('id', booking.user_package_id)

      // Update booking status
      await adminClient
        .from(TABLES.BOOKINGS)
        .update({
          status: 'cancelled',
          cancellation_reason: 'Class cancelled by admin',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      refundedBookings++
    } catch (err) {
      console.error(`[ClassService] Failed to refund booking ${booking.id}:`, err)
    }
  }

  // Cancel all waitlist entries
  await adminClient
    .from(TABLES.WAITLIST)
    .update({
      status: 'cancelled',
    })
    .eq('class_id', classId)
    .eq('status', 'waiting')

  // Send cancellation notifications to all affected users (in-app and email)
  if (refundedBookings > 0) {
    try {
      const { sendNotification } = await import('./notification.service')
      const { data: cancelledBookings } = await adminClient
        .from(TABLES.BOOKINGS)
        .select('user_id, tokens_used')
        .eq('class_id', classId)
        .eq('status', 'cancelled')

      if (cancelledBookings) {
        const uniqueUserIds = [...new Set(cancelledBookings.map(b => b.user_id as string))]
        const classDate = new Date(classData.scheduled_at)
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

        for (const userId of uniqueUserIds) {
          // In-app notification
          await sendNotification({
            userId,
            type: 'class_cancelled',
            channel: 'in_app',
            data: {
              class_title: classData.title,
              class_date: formattedDate,
              refunded: true,
            },
          })

          // Email notification
          const { data: userProfile } = await adminClient
            .from('user_profiles')
            .select('email, name')
            .eq('id', userId)
            .single()

          const userBooking = cancelledBookings.find(b => b.user_id === userId)
          const tokensRefunded = userBooking?.tokens_used || 0

          if (userProfile?.email && userProfile?.name) {
            await fetch(`${webAppUrl}/api/email/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'class-cancellation',
                secret: emailApiSecret,
                data: {
                  userEmail: userProfile.email,
                  userName: userProfile.name,
                  className: classData.title,
                  classDate: formattedDate,
                  classTime: formattedTime,
                  tokensRefunded,
                },
              }),
            })
            console.log(`[ClassService] Class cancellation email sent to ${userProfile.email}`)
          }
        }
      }
    } catch (notificationError) {
      console.error('[Class Service] Error sending cancellation notifications:', notificationError)
      // Don't fail the cancellation if notifications fail
    }
  }

  return {
    success: true,
    message: `Class cancelled. ${refundedBookings} booking(s) refunded.`,
    refundedBookings,
  }
}

// Get class attendees (admin only)
export async function getClassAttendees(classId: string): Promise<ClassAttendeesResponse> {
  // Verify class exists
  const { data: classData, error: classError } = await supabase
    .from(TABLES.CLASSES)
    .select('id')
    .eq('id', classId)
    .single()

  if (classError || !classData) {
    throw new ApiError('NOT_FOUND_ERROR', 'Class not found', 404)
  }

  // Get bookings with user info
  const { data: bookings, error } = await supabase
    .from(TABLES.BOOKINGS)
    .select(`
      id,
      user_id,
      status,
      booked_at,
      users(name, email),
      attendances(checked_in_at)
    `)
    .eq('class_id', classId)
    .in('status', ['confirmed', 'attended', 'no-show'])
    .order('booked_at', { ascending: true })

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch attendees', 500, error)
  }

  const attendees = (bookings || []).map((booking: Record<string, unknown>) => {
    const user = booking.users as { name: string; email: string } | null
    const attendances = booking.attendances as { checked_in_at: string }[] | null

    return {
      bookingId: booking.id as string,
      userId: booking.user_id as string,
      userName: user?.name || 'Unknown',
      userEmail: user?.email || 'unknown@email.com',
      status: booking.status as string,
      bookedAt: booking.booked_at as string,
      checkedInAt: attendances?.[0]?.checked_in_at || null,
    }
  })

  const confirmedCount = attendees.filter(a => a.status === 'confirmed').length
  const attendedCount = attendees.filter(a => a.status === 'attended').length

  return {
    classId,
    attendees,
    total: attendees.length,
    confirmedCount,
    attendedCount,
  }
}

// Get upcoming classes (public)
export async function getUpcomingClasses(limit: number = 10): Promise<ClassListResponse> {
  return listClasses({
    page: 1,
    pageSize: limit,
    startDate: new Date().toISOString(),
    status: 'scheduled',
  })
}

// Helper: Get booking counts for multiple classes
// Counts both 'confirmed' and 'attended' bookings as enrolled (they both take up capacity)
// Excludes cancelled bookings (cancelled, cancelled-late) and no-show
// Uses admin client to bypass RLS and read all bookings
async function getBookingCounts(classIds: string[]): Promise<Record<string, number>> {
  if (classIds.length === 0) return {}

  const adminClient = getSupabaseAdminClient()
  
  const { data, error } = await adminClient
    .from(TABLES.BOOKINGS)
    .select('class_id')
    .in('class_id', classIds)
    .in('status', ['confirmed', 'attended']) // Count both confirmed and attended as enrolled

  if (error) {
    console.error('[Class Service] Error fetching booking counts:', error)
    return {}
  }

  const counts: Record<string, number> = {}
  for (const booking of data || []) {
    const classId = booking.class_id as string
    counts[classId] = (counts[classId] || 0) + 1
  }
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[Class Service] Booking counts for', classIds.length, 'classes:', counts)
    console.log('[Class Service] Found', data?.length || 0, 'bookings')
  }
  
  return counts
}
// Generate future occurrences for a recurring parent class
// Used by cron job to auto-generate instances
export async function generateFutureOccurrences(parentClassId: string, weeksToGenerate: number = 4): Promise<number> {
  const adminClient = getSupabaseAdminClient()
  
  // Get the parent class
  const { data: parentClass, error: parentError } = await adminClient
    .from(TABLES.CLASSES)
    .select('*')
    .eq('id', parentClassId)
    .single()
  
  if (parentError || !parentClass) {
    throw new ApiError('NOT_FOUND_ERROR', 'Parent class not found', 404)
  }
  
  // Verify it's a recurring parent class
  if (parentClass.parent_class_id !== null) {
    throw new ApiError('VALIDATION_ERROR', 'This is not a parent class', 400)
  }
  
  if (parentClass.recurrence_type !== 'recurring') {
    throw new ApiError('VALIDATION_ERROR', 'This is not a recurring class', 400)
  }
  
  // Get the last generated occurrence for this parent
  const { data: lastOccurrence } = await adminClient
    .from(TABLES.CLASSES)
    .select('scheduled_at')
    .eq('parent_class_id', parentClassId)
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .single()
  
  if (!lastOccurrence) {
    console.log(`[generateFutureOccurrences] No existing occurrences for parent ${parentClassId}`)
    return 0
  }
  
  // Generate new occurrences starting from day after last occurrence
  const startDate = new Date(lastOccurrence.scheduled_at)
  startDate.setDate(startDate.getDate() + 1)
  
  const recurrencePattern = parentClass.recurrence_pattern 
    ? JSON.parse(parentClass.recurrence_pattern as string)
    : null
  
  const newOccurrences = generateOccurrences(
    startDate,
    'recurring',
    recurrencePattern,
    weeksToGenerate
  )
  
  // Remove first item (it's the start date we passed in)
  newOccurrences.shift()
  
  if (newOccurrences.length === 0) {
    console.log(`[generateFutureOccurrences] No new occurrences to generate for parent ${parentClassId}`)
    return 0
  }
  
  // Create occurrence classes
  const occurrenceClasses = newOccurrences.map(occurrenceDate => ({
    title: `${parentClass.title} - ${occurrenceDate.toLocaleDateString()}`,
    description: parentClass.description,
    class_type: parentClass.class_type,
    level: parentClass.level,
    age_group: parentClass.age_group || 'all',
    instructor_id: parentClass.instructor_id,
    instructor_name: parentClass.instructor_name,
    scheduled_at: occurrenceDate.toISOString(),
    duration_minutes: parentClass.duration_minutes,
    capacity: parentClass.capacity,
    token_cost: parentClass.token_cost,
    location: parentClass.location,
    status: 'scheduled',
    room_id: parentClass.room_id,
    category_id: parentClass.category_id,
    recurrence_type: 'recurring',
    recurrence_pattern: parentClass.recurrence_pattern,
    parent_class_id: parentClassId,
    occurrence_date: occurrenceDate.toISOString().split('T')[0],
    allow_drop_in: parentClass.allow_drop_in,
    drop_in_token_cost: parentClass.drop_in_token_cost,
  }))
  
  const { error: insertError } = await adminClient
    .from(TABLES.CLASSES)
    .insert(occurrenceClasses)
  
  if (insertError) {
    console.error('[generateFutureOccurrences] Error creating occurrences:', insertError)
    throw new ApiError('SERVER_ERROR', 'Failed to create class occurrences', 500)
  }
  
  console.log(`[generateFutureOccurrences] Generated ${newOccurrences.length} new occurrences for parent ${parentClassId}`)
  return newOccurrences.length
}
// Helper: Get waitlist counts for multiple classes
async function getWaitlistCounts(classIds: string[]): Promise<Record<string, number>> {
  if (classIds.length === 0) return {}

  const { data } = await supabase
    .from(TABLES.WAITLIST)
    .select('class_id')
    .in('class_id', classIds)
    .eq('status', 'waiting')

  const counts: Record<string, number> = {}
  for (const entry of data || []) {
    const classId = entry.class_id as string
    counts[classId] = (counts[classId] || 0) + 1
  }
  return counts
}

// Helper: Map database row to schema
function mapClassToSchema(row: Record<string, unknown>): Class {
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
    recurrenceType: (row.recurrence_type as 'single' | 'recurring' | 'course' | undefined) || 'single',
    recurrencePattern: (row.recurrence_pattern as Record<string, unknown> | null) || null,
    roomId: row.room_id as string | null | undefined,
    categoryId: row.category_id as string | null | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
