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
function generateOccurrences(
  startDate: Date,
  recurrenceType: 'single' | 'recurring' | 'course',
  recurrencePattern?: Record<string, unknown>
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
    // Course: Fixed number of sessions
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
    // Recurring: Weekly until end date or indefinitely (max 52 weeks)
    let currentDate = new Date(startDate)
    const maxOccurrences = 52 // Limit to 1 year of weekly classes

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

      if (endDate && currentDate > endDate) {
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
}): Promise<ClassResponse> {
  // Use admin client to bypass RLS for admin operations
  const adminClient = getSupabaseAdminClient()
  
  // Validate scheduled time is in the future
  if (new Date(data.scheduledAt) <= new Date()) {
    throw new ApiError('VALIDATION_ERROR', 'Class must be scheduled in the future', 400)
  }

  // Get instructor name if instructorId provided
  let instructorName: string | null = null
  if (data.instructorId) {
    const { data: instructor } = await adminClient
      .from('user_profiles')
      .select('name')
      .eq('id', data.instructorId)
      .single()
    instructorName = instructor?.name || null
  }

  const recurrenceType = data.recurrenceType || 'single'
  const startDate = new Date(data.scheduledAt)

  // Generate all occurrences
  const occurrences = generateOccurrences(startDate, recurrenceType, data.recurrencePattern)

  // Base class data
  const baseClassData = {
    title: data.title,
    description: data.description || null,
    class_type: data.classType,
    level: data.level || 'all_levels',
    instructor_id: data.instructorId || null,
    instructor_name: instructorName,
    duration_minutes: data.durationMinutes || 60,
    capacity: data.capacity,
    token_cost: data.tokenCost || 1,
    location: data.location || null,
    room_id: data.roomId || null,
    category_id: data.categoryId || null,
    recurrence_type: recurrenceType,
    recurrence_pattern: data.recurrencePattern || null,
    status: 'scheduled' as const,
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
  // First create the parent/template class
  const { data: parentClass, error: parentError } = await adminClient
    .from(TABLES.CLASSES)
    .insert({
      ...baseClassData,
      scheduled_at: startDate.toISOString(),
      parent_class_id: null,
      occurrence_date: null,
    })
    .select()
    .single()

  if (parentError) {
    throw new ApiError('SERVER_ERROR', 'Failed to create parent class', 500, parentError)
  }

  // Create all occurrence classes
  const occurrenceClasses = occurrences.slice(1).map(occurrenceDate => ({
    ...baseClassData,
    title: `${data.title} - ${occurrenceDate.toLocaleDateString()}`,
    scheduled_at: occurrenceDate.toISOString(),
    parent_class_id: parentClass.id,
    occurrence_date: occurrenceDate.toISOString().split('T')[0],
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

  // Get booking count
  const { count: bookedCount } = await supabase
    .from(TABLES.BOOKINGS)
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('status', 'confirmed')

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

  // Get booking counts for all classes
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
  if (data.scheduledAt !== undefined) updateData.scheduled_at = data.scheduledAt
  if (data.durationMinutes !== undefined) updateData.duration_minutes = data.durationMinutes
  if (data.capacity !== undefined) updateData.capacity = data.capacity
  if (data.tokenCost !== undefined) updateData.token_cost = data.tokenCost
  if (data.location !== undefined) updateData.location = data.location
  if (data.status !== undefined) updateData.status = data.status

  // Handle instructor update
  if (data.instructorId !== undefined) {
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

  const { data: classData, error } = await adminClient
    .from(TABLES.CLASSES)
    .update(updateData)
    .eq('id', classId)
    .select()
    .single()

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to update class', 500, error)
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
async function getBookingCounts(classIds: string[]): Promise<Record<string, number>> {
  if (classIds.length === 0) return {}

  const { data } = await supabase
    .from(TABLES.BOOKINGS)
    .select('class_id')
    .in('class_id', classIds)
    .eq('status', 'confirmed')

  const counts: Record<string, number> = {}
  for (const booking of data || []) {
    const classId = booking.class_id as string
    counts[classId] = (counts[classId] || 0) + 1
  }
  return counts
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
