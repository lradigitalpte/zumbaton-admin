// Scheduled Jobs Service
// Handles all scheduled background tasks

import { processNoShows } from './attendance.service'
import { processExpiredPackages, processFrozenPackages } from './user-package.service'
import { processExpiredWaitlistNotifications } from './waitlist.service'

// Job results interface
interface JobResult {
  jobName: string
  success: boolean
  duration: number
  details: Record<string, unknown>
  error?: string
}

// Run all scheduled jobs
export async function runAllScheduledJobs(): Promise<JobResult[]> {
  const results: JobResult[] = []

  // Job 1: Process expired packages
  results.push(await runJob('processExpiredPackages', async () => {
    return await processExpiredPackages()
  }))

  // Job 2: Process frozen packages
  results.push(await runJob('processFrozenPackages', async () => {
    return await processFrozenPackages()
  }))

  // Job 3: Process no-shows
  results.push(await runJob('processNoShows', async () => {
    return await processNoShows()
  }))

  // Job 4: Process expired waitlist notifications
  results.push(await runJob('processExpiredWaitlistNotifications', async () => {
    return await processExpiredWaitlistNotifications()
  }))

  // Job 5: Mark past single classes as completed
  results.push(await runJob('markCompletedClasses', async () => {
    return await markCompletedClasses()
  }))

  // Job 6: Send token balance low warnings
  results.push(await runJob('sendTokenBalanceLowWarnings', async () => {
    return await sendTokenBalanceLowWarnings()
  }))

  return results
}

// Run individual job with timing and error handling
async function runJob(
  jobName: string,
  jobFn: () => Promise<unknown>
): Promise<JobResult> {
  const startTime = Date.now()

  try {
    const details = await jobFn()
    const duration = Date.now() - startTime

    console.log(`[ScheduledJob] ${jobName} completed in ${duration}ms`, details)

    return {
      jobName,
      success: true,
      duration,
      details: typeof details === 'object' && details !== null ? (details as Record<string, unknown>) : {},
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error(`[ScheduledJob] ${jobName} failed after ${duration}ms:`, error)

    return {
      jobName,
      success: false,
      duration,
      details: {},
      error: errorMessage,
    }
  }
}

// Individual job runners (for cron/edge functions)

export async function runExpiredPackagesJob(): Promise<JobResult> {
  return runJob('processExpiredPackages', processExpiredPackages)
}

export async function runFrozenPackagesJob(): Promise<JobResult> {
  return runJob('processFrozenPackages', processFrozenPackages)
}

export async function runNoShowsJob(): Promise<JobResult> {
  return runJob('processNoShows', processNoShows)
}

export async function runWaitlistExpiryJob(): Promise<JobResult> {
  return runJob('processExpiredWaitlistNotifications', processExpiredWaitlistNotifications)
}

// Mark past classes as completed (daily job)
// This applies to ALL class types (single, recurring, course) - any class whose date has passed
export async function markCompletedClasses(): Promise<JobResult> {
  return runJob('markCompletedClasses', async () => {
    const { getSupabaseAdminClient, TABLES } = await import('@/lib/supabase')
    const supabase = getSupabaseAdminClient()

    const now = new Date()
    
    // Find ALL classes (single, recurring, course) that have passed their scheduled date + duration
    // but are still marked as 'scheduled'
    // We need to check classes where scheduled_at + duration_minutes < now
    const { data: allScheduledClasses, error: fetchError } = await supabase
      .from(TABLES.CLASSES)
      .select('id, title, scheduled_at, duration_minutes, recurrence_type')
      .eq('status', 'scheduled')

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled classes: ${fetchError.message}`)
    }

    if (!allScheduledClasses || allScheduledClasses.length === 0) {
      return { classesMarked: 0, message: 'No scheduled classes to check' }
    }

    // Filter classes where the class end time (scheduled_at + duration) has passed
    const pastClasses = allScheduledClasses.filter(c => {
      const classDate = new Date(c.scheduled_at)
      const classEndTime = new Date(classDate)
      classEndTime.setMinutes(classEndTime.getMinutes() + (c.duration_minutes || 60))
      return classEndTime < now
    })

    if (!pastClasses || pastClasses.length === 0) {
      return { classesMarked: 0, message: 'No past classes to mark as completed' }
    }

    const classIds = pastClasses.map(c => c.id)

    // Update status to 'completed' for all past classes
    const { error: updateError } = await supabase
      .from(TABLES.CLASSES)
      .update({ 
        status: 'completed',
        updated_at: now.toISOString()
      })
      .in('id', classIds)

    if (updateError) {
      throw new Error(`Failed to update classes: ${updateError.message}`)
    }

    // Count by type for reporting
    const singleCount = pastClasses.filter(c => !c.recurrence_type || c.recurrence_type === 'single').length
    const recurringCount = pastClasses.filter(c => c.recurrence_type === 'recurring').length
    const courseCount = pastClasses.filter(c => c.recurrence_type === 'course').length

    return { 
      classesMarked: pastClasses.length,
      singleClasses: singleCount,
      recurringClasses: recurringCount,
      courseClasses: courseCount,
      classIds: classIds
    }
  })
}

// Send token expiry warnings (daily job)
export async function sendTokenExpiryWarnings(): Promise<JobResult> {
  return runJob('sendTokenExpiryWarnings', async () => {
    // Import supabase here to avoid circular dependencies
    const { supabase, TABLES } = await import('@/lib/supabase')

    // Find packages expiring in 3 days
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const { data: expiringPackages } = await supabase
      .from(TABLES.USER_PACKAGES)
      .select(`
        id,
        user_id,
        tokens_remaining,
        expires_at,
        users(email, name)
      `)
      .eq('status', 'active')
      .gt('tokens_remaining', 0)
      .lt('expires_at', threeDaysFromNow.toISOString())
      .gt('expires_at', new Date().toISOString())

    let notificationsSent = 0

    for (const pkg of expiringPackages || []) {
      try {
        const { sendNotification } = await import('./notification.service')
        const user = pkg.users as any
        
        if (user?.email && user?.name) {
          const expiresDate = new Date(pkg.expires_at)
          const formattedDate = expiresDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })

          // Send in-app notification
          await sendNotification({
            userId: pkg.user_id,
            type: 'package_expiring',
            channel: 'in_app',
            data: {
              user_name: user.name,
              tokens_remaining: pkg.tokens_remaining,
              expires_at: formattedDate,
            },
          })

          // Send email notification
          await sendNotification({
            userId: pkg.user_id,
            type: 'package_expiring',
            channel: 'email',
            data: {
              user_name: user.name,
              tokens_remaining: pkg.tokens_remaining,
              expires_at: formattedDate,
            },
          })

          notificationsSent++
        }
      } catch (error) {
        console.error(`[Scheduled Jobs] Error sending token expiry warning for user ${pkg.user_id}:`, error)
        // Continue processing other packages even if one fails
      }
    }

    return { notificationsSent }
  })
}

// Class reminder notifications (runs every 15 minutes)
export async function sendClassReminders(): Promise<JobResult> {
  return runJob('sendClassReminders', async () => {
    const { supabase, TABLES } = await import('@/lib/supabase')

    // Find classes starting in 2 hours
    const twoHoursFromNow = new Date()
    twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2)
    const twoHoursAndFifteenMins = new Date()
    twoHoursAndFifteenMins.setHours(twoHoursAndFifteenMins.getHours() + 2)
    twoHoursAndFifteenMins.setMinutes(twoHoursAndFifteenMins.getMinutes() + 15)

    // Get classes in the 2h-2h15m window with instructor info
    const { data: upcomingClasses } = await supabase
      .from(TABLES.CLASSES)
      .select('id, title, scheduled_at, instructor_id, location')
      .eq('status', 'scheduled')
      .gte('scheduled_at', twoHoursFromNow.toISOString())
      .lt('scheduled_at', twoHoursAndFifteenMins.toISOString())

    let studentRemindersSent = 0
    let tutorRemindersSent = 0

    for (const classData of upcomingClasses || []) {
      const classDate = new Date(classData.scheduled_at)
      const formattedTime = classDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      })
      const formattedDate = classDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      })

      // Send reminder to TUTOR
      if (classData.instructor_id) {
        try {
          const { sendNotification } = await import('./notification.service')
          
          // Get tutor details
          const { data: tutorProfile } = await supabase
            .from('user_profiles')
            .select('name, email')
            .eq('id', classData.instructor_id)
            .single()

          if (tutorProfile) {
            // Get booking count for this class
            const { count: bookedCount } = await supabase
              .from(TABLES.BOOKINGS)
              .select('id', { count: 'exact', head: true })
              .eq('class_id', classData.id)
              .eq('status', 'confirmed')

            await sendNotification({
              userId: classData.instructor_id,
              type: 'booking_reminder',
              channel: 'in_app',
              data: {
                is_tutor_notification: true,
                user_name: tutorProfile.name,
                class_title: classData.title,
                class_date: formattedDate,
                class_time: formattedTime,
                class_location: classData.location || 'TBA',
                booked_count: bookedCount || 0,
                message: `Your class "${classData.title}" starts in 2 hours at ${formattedTime}. ${bookedCount || 0} student(s) booked.`,
              },
            })
            tutorRemindersSent++
          }
        } catch (error) {
          console.error(`[Scheduled Jobs] Error sending tutor reminder for class ${classData.id}:`, error)
        }
      }

      // Send reminders to STUDENTS
      const { data: bookings } = await supabase
        .from(TABLES.BOOKINGS)
        .select(`
          user_id,
          users(email, name)
        `)
        .eq('class_id', classData.id)
        .eq('status', 'confirmed')

      for (const booking of bookings || []) {
        try {
          const { sendNotification, sendBookingReminder } = await import('./notification.service')
          const user = booking.users as any
          
          if (user?.email && user?.name) {
            // Send in-app notification
            await sendNotification({
              userId: booking.user_id,
              type: 'booking_reminder',
              channel: 'in_app',
              data: {
                user_name: user.name,
                class_title: classData.title,
                class_time: formattedTime,
                class_location: classData.location || 'TBA',
              },
            })

            // Send push notification (email reminder)
            await sendBookingReminder(booking.user_id, {
              userName: user.name,
              classTitle: classData.title,
              classTime: formattedTime,
              classLocation: classData.location || 'TBA',
            })

            studentRemindersSent++
          }
        } catch (error) {
          console.error(`[Scheduled Jobs] Error sending reminder for booking ${booking.user_id}:`, error)
          // Continue processing other bookings even if one fails
        }
      }
    }

    return { 
      studentRemindersSent, 
      tutorRemindersSent,
      totalReminders: studentRemindersSent + tutorRemindersSent,
      classesProcessed: upcomingClasses?.length || 0 
    }
  })
}

// Token balance low notifications (daily job)
// Sends notification when user's total available tokens drop below threshold
export async function sendTokenBalanceLowWarnings(): Promise<JobResult> {
  return runJob('sendTokenBalanceLowWarnings', async () => {
    const { supabase, TABLES } = await import('@/lib/supabase')

    // Default threshold - can be made configurable via admin settings
    const LOW_TOKEN_THRESHOLD = 3

    // Get all active users with their total token balance
    const { data: userPackages } = await supabase
      .from(TABLES.USER_PACKAGES)
      .select(`
        user_id,
        tokens_remaining,
        tokens_held,
        user_profiles(name, email)
      `)
      .eq('status', 'active')

    if (!userPackages || userPackages.length === 0) {
      return { notificationsSent: 0, message: 'No active packages found' }
    }

    // Aggregate tokens per user
    const userTokens: Record<string, { total: number; name: string; email: string }> = {}
    for (const pkg of userPackages) {
      const userId = pkg.user_id as string
      const available = (pkg.tokens_remaining || 0) - (pkg.tokens_held || 0)
      const profile = pkg.user_profiles as any
      
      if (!userTokens[userId]) {
        userTokens[userId] = { 
          total: 0, 
          name: profile?.name || 'User',
          email: profile?.email || ''
        }
      }
      userTokens[userId].total += Math.max(0, available)
    }

    // Check for low balance notifications already sent today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('type', 'token_balance_low')
      .gte('created_at', today.toISOString())

    const notifiedToday = new Set((recentNotifications || []).map(n => n.user_id))

    let notificationsSent = 0

    for (const [userId, data] of Object.entries(userTokens)) {
      // Skip if already notified today or balance is above threshold
      if (notifiedToday.has(userId) || data.total >= LOW_TOKEN_THRESHOLD) {
        continue
      }

      try {
        const { sendNotification } = await import('./notification.service')

        // Send in-app notification
        await sendNotification({
          userId,
          type: 'token_balance_low',
          channel: 'in_app',
          data: {
            user_name: data.name,
            current_balance: data.total,
            threshold: LOW_TOKEN_THRESHOLD,
            message: `Your token balance is running low! You have ${data.total} token${data.total === 1 ? '' : 's'} remaining.`,
          },
        })

        // Send email notification
        await sendNotification({
          userId,
          type: 'token_balance_low',
          channel: 'email',
          data: {
            user_name: data.name,
            current_balance: data.total,
            threshold: LOW_TOKEN_THRESHOLD,
          },
        })

        notificationsSent++
      } catch (error) {
        console.error(`[Scheduled Jobs] Error sending token balance low warning for user ${userId}:`, error)
      }
    }

    return { 
      notificationsSent, 
      threshold: LOW_TOKEN_THRESHOLD,
      usersChecked: Object.keys(userTokens).length 
    }
  })
}

// Summary of all jobs
export function getJobSchedule() {
  return {
    jobs: [
      {
        name: 'processExpiredPackages',
        description: 'Marks expired packages as expired and logs lost tokens',
        frequency: 'Daily at midnight',
        cron: '0 0 * * *',
      },
      {
        name: 'processFrozenPackages',
        description: 'Unfreezes packages whose freeze period has ended',
        frequency: 'Daily at midnight',
        cron: '0 0 * * *',
      },
      {
        name: 'processNoShows',
        description: 'Marks confirmed bookings as no-show after class ends',
        frequency: 'Every hour',
        cron: '0 * * * *',
      },
      {
        name: 'processExpiredWaitlistNotifications',
        description: 'Expires waitlist notifications and notifies next person',
        frequency: 'Every 15 minutes',
        cron: '*/15 * * * *',
      },
      {
        name: 'sendTokenExpiryWarnings',
        description: 'Sends email to users with tokens expiring in 3 days',
        frequency: 'Daily at 9am',
        cron: '0 9 * * *',
      },
      {
        name: 'sendClassReminders',
        description: 'Sends reminders for classes starting in 2 hours',
        frequency: 'Every 15 minutes',
        cron: '*/15 * * * *',
      },
      {
        name: 'markCompletedClasses',
        description: 'Marks all past classes (single, recurring, course) as completed',
        frequency: 'Daily at midnight',
        cron: '0 0 * * *',
      },
      {
        name: 'sendTokenBalanceLowWarnings',
        description: 'Warns users when their token balance drops below threshold (default: 3)',
        frequency: 'Daily at 10am',
        cron: '0 10 * * *',
      },
    ],
  }
}
