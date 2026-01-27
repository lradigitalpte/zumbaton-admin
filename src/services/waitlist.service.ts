// Waitlist Service
// Handles waitlist operations for full classes

import { supabase, TABLES } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import { createBooking } from './booking.service'
import type {
  Waitlist,
  WaitlistWithClass,
  JoinWaitlistResponse,
  LeaveWaitlistResponse,
  UserWaitlistResponse,
  AdminWaitlistResponse,
  AdminWaitlistQuery,
  ConfirmWaitlistResponse,
} from '@/api/schemas'

// Configuration
const WAITLIST_CONFIRMATION_MINUTES = 30 // How long user has to confirm after being notified

// Join waitlist for a class
export async function joinWaitlist(params: {
  userId: string
  classId: string
}): Promise<JoinWaitlistResponse> {
  const { userId, classId } = params

  // 1. Check if class exists
  const { data: classData, error: classError } = await supabase
    .from(TABLES.CLASSES)
    .select('*')
    .eq('id', classId)
    .eq('status', 'scheduled')
    .single()

  if (classError || !classData) {
    throw new ApiError('NOT_FOUND_ERROR', 'Class not found or not available', 404)
  }

  // Check if class is in the future
  if (new Date(classData.scheduled_at) <= new Date()) {
    throw new ApiError('VALIDATION_ERROR', 'Cannot join waitlist for past classes', 400)
  }

  // 2. Check if user already has a booking or waitlist entry
  const { data: existingBooking } = await supabase
    .from(TABLES.BOOKINGS)
    .select('id')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .in('status', ['confirmed', 'waitlist'])
    .single()

  if (existingBooking) {
    throw new ApiError('CONFLICT_ERROR', 'You already have a booking for this class', 409)
  }

  const { data: existingWaitlist } = await supabase
    .from(TABLES.WAITLIST)
    .select('id, position')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .in('status', ['waiting', 'notified'])
    .single()

  if (existingWaitlist) {
    throw new ApiError('CONFLICT_ERROR', `You are already on the waitlist at position ${existingWaitlist.position}`, 409)
  }

  // 3. Get current max position
  const { data: maxPositionResult } = await supabase
    .from(TABLES.WAITLIST)
    .select('position')
    .eq('class_id', classId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const newPosition = (maxPositionResult?.position || 0) + 1

  // 4. Create waitlist entry
  const { data: waitlistEntry, error: insertError } = await supabase
    .from(TABLES.WAITLIST)
    .insert({
      user_id: userId,
      class_id: classId,
      position: newPosition,
      joined_at: new Date().toISOString(),
      status: 'waiting',
      created_at: new Date().toISOString(),
    })
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `)
    .single()

  if (insertError) {
    throw new ApiError('SERVER_ERROR', 'Failed to join waitlist', 500, insertError)
  }

  return {
    waitlist: mapWaitlistToSchema(waitlistEntry),
    position: newPosition,
    estimatedWait: getEstimatedWait(newPosition),
    message: `You are now #${newPosition} on the waitlist for ${classData.title}`,
  }
}

// Leave waitlist
export async function leaveWaitlist(params: {
  userId: string
  classId: string
}): Promise<LeaveWaitlistResponse> {
  const { userId, classId } = params

  // Find and update waitlist entry
  const { data: entry, error } = await supabase
    .from(TABLES.WAITLIST)
    .update({
      status: 'cancelled',
    })
    .eq('user_id', userId)
    .eq('class_id', classId)
    .in('status', ['waiting', 'notified'])
    .select()
    .single()

  if (error || !entry) {
    throw new ApiError('NOT_FOUND_ERROR', 'Waitlist entry not found', 404)
  }

  // Reorder positions for remaining entries
  await reorderWaitlistPositions(classId)

  return {
    classId,
    message: 'Successfully removed from waitlist',
  }
}

// Get user's waitlist entries
export async function getUserWaitlist(userId: string): Promise<UserWaitlistResponse> {
  const { data: entries, error } = await supabase
    .from(TABLES.WAITLIST)
    .select(`
      *,
      class:${TABLES.CLASSES}(*)
    `)
    .eq('user_id', userId)
    .in('status', ['waiting', 'notified'])
    .order('joined_at', { ascending: true })

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch waitlist', 500, error)
  }

  return {
    entries: (entries || []).map(mapWaitlistToSchema),
    total: entries?.length || 0,
  }
}

// Get waitlist entries (admin)
export async function getAdminWaitlist(query: AdminWaitlistQuery): Promise<AdminWaitlistResponse> {
  const { classId, userId, status, page = 1, pageSize = 20 } = query

  let dbQuery = supabase
    .from(TABLES.WAITLIST)
    .select(`
      *,
      class:${TABLES.CLASSES}(*),
      users(name, email)
    `, { count: 'exact' })
    .order('position', { ascending: true })

  if (classId) {
    dbQuery = dbQuery.eq('class_id', classId)
  }

  if (userId) {
    dbQuery = dbQuery.eq('user_id', userId)
  }

  if (status) {
    dbQuery = dbQuery.eq('status', status)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  dbQuery = dbQuery.range(from, to)

  const { data, error, count } = await dbQuery

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch waitlist', 500, error)
  }

  const entries = (data || []).map((entry: Record<string, unknown>) => {
    const user = entry.users as { name: string; email: string } | null
    return {
      ...mapWaitlistToSchema(entry),
      userName: user?.name || 'Unknown',
      userEmail: user?.email || 'unknown@email.com',
    }
  })

  return {
    entries,
    total: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > page * pageSize,
  }
}

// Confirm waitlist spot (convert to booking)
export async function confirmWaitlistSpot(params: {
  userId: string
  waitlistId: string
}): Promise<ConfirmWaitlistResponse> {
  const { userId, waitlistId } = params

  // Get waitlist entry
  const { data: entry, error: fetchError } = await supabase
    .from(TABLES.WAITLIST)
    .select('*')
    .eq('id', waitlistId)
    .eq('user_id', userId)
    .eq('status', 'notified')
    .single()

  if (fetchError || !entry) {
    throw new ApiError('NOT_FOUND_ERROR', 'Waitlist entry not found or not eligible for confirmation', 404)
  }

  // Check if confirmation window has expired
  if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
    // Expire the entry
    await supabase
      .from(TABLES.WAITLIST)
      .update({ status: 'expired' })
      .eq('id', waitlistId)

    throw new ApiError('VALIDATION_ERROR', 'Confirmation window has expired', 400)
  }

  // Create booking (this will hold tokens)
  try {
    const bookingResponse = await createBooking({
      userId,
      classId: entry.class_id,
    })

    // Mark waitlist entry as converted
    await supabase
      .from(TABLES.WAITLIST)
      .update({ status: 'converted' })
      .eq('id', waitlistId)

    return {
      bookingId: bookingResponse.booking.id,
      classId: entry.class_id,
      tokensHeld: bookingResponse.tokensHeld,
      message: 'Successfully converted to booking',
    }
  } catch (err) {
    // If booking fails, keep waitlist entry as notified
    throw err
  }
}

// Process waitlist when a spot opens (called when booking is cancelled)
export async function processWaitlistForClass(classId: string): Promise<{
  notified: number
  classId: string
}> {
  // Get class to check capacity
  const { data: classData } = await supabase
    .from(TABLES.CLASSES)
    .select('capacity')
    .eq('id', classId)
    .single()

  if (!classData) {
    return { notified: 0, classId }
  }

  // Get current booking count - count both confirmed and attended as enrolled
  const { count: bookedCount } = await supabase
    .from(TABLES.BOOKINGS)
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId)
    .in('status', ['confirmed', 'attended'])

  const spotsAvailable = classData.capacity - (bookedCount || 0)

  if (spotsAvailable <= 0) {
    return { notified: 0, classId }
  }

  // Get next person(s) on waitlist
  const { data: waitlistEntries } = await supabase
    .from(TABLES.WAITLIST)
    .select('*')
    .eq('class_id', classId)
    .eq('status', 'waiting')
    .order('position', { ascending: true })
    .limit(spotsAvailable)

  let notified = 0

  for (const entry of waitlistEntries || []) {
    const expiresAt = new Date(Date.now() + WAITLIST_CONFIRMATION_MINUTES * 60 * 1000).toISOString()

    // Update status to notified
    await supabase
      .from(TABLES.WAITLIST)
      .update({
        status: 'notified',
        notified_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq('id', entry.id)

    // Send notification to user (in-app and email)
    try {
      const { sendNotification, sendWaitlistSpotAvailable } = await import('./notification.service')
      const { data: classData } = await supabase
        .from(TABLES.CLASSES)
        .select('title, scheduled_at')
        .eq('id', classId)
        .single()

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('id', entry.user_id)
        .single()

      if (classData && userProfile) {
        const classDate = new Date(classData.scheduled_at)
        const formattedDate = classDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })

        // Send in-app notification
        await sendNotification({
          userId: entry.user_id,
          type: 'waitlist_spot_available',
          channel: 'in_app',
          data: {
            user_name: userProfile.name,
            class_title: classData.title,
            class_date: formattedDate,
            confirm_url: `/bookings/waitlist/${entry.id}/confirm`,
          },
        })

        // Send email notification via web app API
        const { data: userEmailData } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', entry.user_id)
          .single()

        if (userEmailData?.email) {
          const { getWebAppUrl } = await import('@/lib/email-url')
          const webAppUrl = getWebAppUrl()
          const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'
          const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/bookings/waitlist/${entry.id}/confirm`

          await fetch(`${webAppUrl}/api/email/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'waitlist-promotion',
              secret: emailApiSecret,
              data: {
                userEmail: userEmailData.email,
                userName: userProfile.name,
                className: classData.title,
                classDate: formattedDate,
                confirmUrl,
                expiresIn: expiresAt ? `In ${Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60))} minutes` : undefined,
              },
            }),
          })
          console.log(`[WaitlistService] Waitlist promotion email sent to ${userEmailData.email}`)
        }
      }
    } catch (notificationError) {
      // Log but don't fail waitlist processing if notification fails
      console.error('[Waitlist] Error sending notification:', notificationError)
    }

    notified++
  }

  return { notified, classId }
}

// Process expired waitlist notifications (scheduled job)
export async function processExpiredWaitlistNotifications(): Promise<{
  expired: number
  renotified: number
}> {
  // Find entries where notification has expired
  const { data: expiredEntries } = await supabase
    .from(TABLES.WAITLIST)
    .select('id, class_id')
    .eq('status', 'notified')
    .lt('expires_at', new Date().toISOString())

  let expired = 0
  const classesToProcess = new Set<string>()

  for (const entry of expiredEntries || []) {
    // Mark as expired
    await supabase
      .from(TABLES.WAITLIST)
      .update({ status: 'expired' })
      .eq('id', entry.id)

    classesToProcess.add(entry.class_id)
    expired++
  }

  // Reprocess waitlist for affected classes
  let renotified = 0
  for (const classId of classesToProcess) {
    const result = await processWaitlistForClass(classId)
    renotified += result.notified
  }

  return { expired, renotified }
}

// Helper: Reorder waitlist positions after someone leaves
async function reorderWaitlistPositions(classId: string): Promise<void> {
  const { data: entries } = await supabase
    .from(TABLES.WAITLIST)
    .select('id')
    .eq('class_id', classId)
    .in('status', ['waiting', 'notified'])
    .order('position', { ascending: true })

  for (let i = 0; i < (entries?.length || 0); i++) {
    await supabase
      .from(TABLES.WAITLIST)
      .update({ position: i + 1 })
      .eq('id', entries![i].id)
  }
}

// Helper: Estimate wait time based on position
function getEstimatedWait(position: number): string {
  if (position <= 2) return 'High chance of getting a spot'
  if (position <= 5) return 'Moderate chance of getting a spot'
  return 'Lower chance, but you will be notified if a spot opens'
}

// Helper: Map database row to schema
function mapWaitlistToSchema(row: Record<string, unknown>): WaitlistWithClass {
  const classData = row.class as Record<string, unknown> | null

  return {
    id: row.id as string,
    userId: row.user_id as string,
    classId: row.class_id as string,
    position: row.position as number,
    joinedAt: row.joined_at as string,
    notifiedAt: row.notified_at as string | null,
    expiresAt: row.expires_at as string | null,
    status: row.status as 'waiting',
    createdAt: row.created_at as string,
    class: classData ? {
      id: classData.id as string,
      title: classData.title as string,
      description: classData.description as string | null,
      classType: classData.class_type as 'zumba',
      level: classData.level as 'all_levels',
      ageGroup: (classData.age_group as 'adult' | 'kid' | 'all') || 'all',
      instructorId: classData.instructor_id as string | null,
      instructorName: classData.instructor_name as string | null,
      scheduledAt: classData.scheduled_at as string,
      durationMinutes: classData.duration_minutes as number,
      capacity: classData.capacity as number,
      tokenCost: classData.token_cost as number,
      location: classData.location as string | null,
      status: classData.status as 'scheduled',
      createdAt: classData.created_at as string,
      updatedAt: classData.updated_at as string,
    } : undefined,
  }
}
