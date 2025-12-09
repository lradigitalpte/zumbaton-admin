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

  return results
}

// Run individual job with timing and error handling
async function runJob(
  jobName: string,
  jobFn: () => Promise<Record<string, unknown>>
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
      details,
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
      // TODO: Send email notification
      // await sendEmail({
      //   to: pkg.users.email,
      //   subject: 'Your tokens are expiring soon',
      //   template: 'token-expiry-warning',
      //   data: {
      //     name: pkg.users.name,
      //     tokensRemaining: pkg.tokens_remaining,
      //     expiresAt: pkg.expires_at,
      //   },
      // })
      notificationsSent++
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

    // Get classes in the 2h-2h15m window
    const { data: upcomingClasses } = await supabase
      .from(TABLES.CLASSES)
      .select('id, title, scheduled_at')
      .eq('status', 'scheduled')
      .gte('scheduled_at', twoHoursFromNow.toISOString())
      .lt('scheduled_at', twoHoursAndFifteenMins.toISOString())

    let remindersSent = 0

    for (const classData of upcomingClasses || []) {
      // Get confirmed bookings for this class
      const { data: bookings } = await supabase
        .from(TABLES.BOOKINGS)
        .select(`
          user_id,
          users(email, name)
        `)
        .eq('class_id', classData.id)
        .eq('status', 'confirmed')

      for (const booking of bookings || []) {
        // TODO: Send reminder email/notification
        // await sendEmail({
        //   to: booking.users.email,
        //   subject: `Reminder: ${classData.title} starts in 2 hours`,
        //   template: 'class-reminder',
        //   data: {
        //     name: booking.users.name,
        //     className: classData.title,
        //     scheduledAt: classData.scheduled_at,
        //   },
        // })
        remindersSent++
      }
    }

    return { remindersSent, classesProcessed: upcomingClasses?.length || 0 }
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
    ],
  }
}
