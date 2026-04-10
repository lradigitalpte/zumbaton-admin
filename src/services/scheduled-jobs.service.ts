// Scheduled Jobs Service
// Handles all scheduled background tasks

import { processNoShows } from './attendance.service'
import { processExpiredPackages, processFrozenPackages } from './user-package.service'
import { processExpiredWaitlistNotifications } from './waitlist.service'
import { autoGenerateFutureClasses } from '@/cron/generate-future-classes'
import { sendAdminEmail } from '@/lib/admin-email'

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

  // Job 7: Auto-generate future class occurrences
  results.push(await runJob('autoGenerateFutureClasses', async () => {
    return await autoGenerateFutureClasses()
  }))

  // Job 8: Sync pending HitPay payments
  results.push(await runJob('syncPendingHitPayPayments', async () => {
    return await syncPendingHitPayPayments()
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

export async function runAutoGenerateClassesJob(): Promise<JobResult> {
  return runJob('autoGenerateFutureClasses', autoGenerateFutureClasses)
}

export async function runSyncPendingPaymentsJob(): Promise<JobResult> {
  return runJob('syncPendingHitPayPayments', syncPendingHitPayPayments)
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

          // Send email notification via web app email API
          try {
            const { getWebAppUrl } = await import('@/lib/email-url')
            const webAppUrl = getWebAppUrl()
            const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'
            
            await fetch(`${webAppUrl}/api/email/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'token-expiry',
                secret: emailApiSecret,
                data: {
                  userEmail: user.email,
                  userName: user.name,
                  tokensRemaining: pkg.tokens_remaining,
                  expiresAt: pkg.expires_at,
                },
              }),
            })
            console.log(`[Scheduled Jobs] Token expiry email sent to ${user.email}`)
          } catch (emailError) {
            console.error(`[Scheduled Jobs] Failed to send token expiry email to ${user.email}:`, emailError)
            // Continue even if email fails
          }

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

    // Find classes starting in 3 hours
    const threeHoursFromNow = new Date()
    threeHoursFromNow.setHours(threeHoursFromNow.getHours() + 3)
    const threeHoursAndFifteenMins = new Date()
    threeHoursAndFifteenMins.setHours(threeHoursAndFifteenMins.getHours() + 3)
    threeHoursAndFifteenMins.setMinutes(threeHoursAndFifteenMins.getMinutes() + 15)

    // Get classes in the 3h-3h15m window with instructor info
    const { data: upcomingClasses } = await supabase
      .from(TABLES.CLASSES)
      .select('id, title, scheduled_at, instructor_id, location')
      .eq('status', 'scheduled')
      .gte('scheduled_at', threeHoursFromNow.toISOString())
      .lt('scheduled_at', threeHoursAndFifteenMins.toISOString())

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
                message: `Your class "${classData.title}" starts in 3 hours at ${formattedTime}. ${bookedCount || 0} student(s) booked.`,
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

            // Send email reminder via web app email API
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
                  type: 'class-reminder',
                  secret: emailApiSecret,
                  data: {
                    userEmail: user.email,
                    userName: user.name,
                    className: classData.title,
                    classDate: formattedDate,
                    classTime: formattedTime,
                    classLocation: classData.location || 'TBA',
                    instructorName,
                  },
                }),
              })
              console.log(`[Scheduled Jobs] Class reminder email sent to ${user.email}`)
            } catch (emailError) {
              console.error(`[Scheduled Jobs] Failed to send class reminder email to ${user.email}:`, emailError)
              // Continue even if email fails
            }

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
// Sync all pending HitPay payments (runs every 15 minutes)
// Catches any payments that were completed on HitPay but whose webhook was missed
export async function syncPendingHitPayPayments(): Promise<Record<string, unknown>> {
  const { getSupabaseAdminClient } = await import('@/lib/supabase')
  const { getPaymentRequestStatus } = await import('./hitpay.service')
  const supabase = getSupabaseAdminClient()

  if (!process.env.HITPAY_API_KEY) {
    console.warn('[Cron: SyncPendingPayments] HITPAY_API_KEY not set — skipping')
    return { skipped: true, reason: 'HITPAY_API_KEY not configured' }
  }

  // Fetch payments that are still pending but were created more than 5 minutes ago
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: pendingPayments, error } = await supabase
    .from('payments')
    .select('id, user_id, package_id, amount_cents, currency, hitpay_payment_request_id, promo_type, discount_percent, discount_amount_cents, packages(*)')
    .eq('status', 'pending')
    .not('hitpay_payment_request_id', 'is', null)
    .lt('created_at', fiveMinutesAgo)

  if (error) {
    throw new Error(`Failed to fetch pending payments: ${error.message}`)
  }

  if (!pendingPayments || pendingPayments.length === 0) {
    return { synced: 0, failed: 0, skipped: 0, message: 'No pending payments to sync' }
  }

  let synced = 0
  let failed = 0
  let skipped = 0

  for (const payment of pendingPayments) {
    try {
      let hitpayData
      try {
        hitpayData = await getPaymentRequestStatus(payment.hitpay_payment_request_id)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        // Payment request not found on HitPay — mark as failed
        if (errMsg.toLowerCase().includes('no query results')) {
          await supabase
            .from('payments')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', payment.id)

          void Promise.resolve().then(async () => {
            const failedPaymentPackage = Array.isArray(payment.packages)
              ? payment.packages[0]
              : payment.packages
            const { data: userProfile } = await supabase
              .from('user_profiles')
              .select('email, name')
              .eq('id', payment.user_id)
              .maybeSingle()

            await sendAdminEmail('payment-alert', {
              paymentId: payment.id,
              event: 'failed',
              paymentType: 'package-purchase',
              source: 'cron-sync',
              amount: payment.amount_cents / 100,
              currency: payment.currency,
              packageName: failedPaymentPackage?.name,
              tokenCount: failedPaymentPackage?.token_count,
              userName: userProfile?.name || 'User',
              userEmail: userProfile?.email || undefined,
              failureReason: 'Not found on HitPay (likely abandoned or expired)',
            })
          }).catch((alertError: unknown) => {
            console.error(`[Cron: SyncPendingPayments] Non-critical: failed to send failed payment alert for ${payment.id}:`, alertError)
          })

          failed++
        } else {
          console.error(`[Cron: SyncPendingPayments] HitPay API error for payment ${payment.id}:`, errMsg)
          skipped++
        }
        continue
      }

      const hitpayStatus = hitpayData.status?.toLowerCase()
      const hitpayPaymentId = hitpayData.payments?.[0]?.id ?? null

      if (hitpayStatus !== 'completed' && hitpayStatus !== 'succeeded') {
        skipped++
        continue
      }

      // Idempotency — check for existing user_package
      const { data: existingPackage } = await supabase
        .from('user_packages')
        .select('id')
        .eq('payment_id', payment.id)
        .maybeSingle()

      if (existingPackage) {
        await supabase
          .from('payments')
          .update({ status: 'succeeded', hitpay_payment_id: hitpayPaymentId, updated_at: new Date().toISOString() })
          .eq('id', payment.id)
        synced++
        continue
      }

      // Resolve package details
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pkg = payment.packages as any
      if (!pkg && payment.package_id) {
        const { data: packageData } = await supabase
          .from('packages')
          .select('*')
          .eq('id', payment.package_id)
          .single()
        pkg = packageData
      }

      if (!pkg) {
        console.error(`[Cron: SyncPendingPayments] Package not found for payment ${payment.id}`)
        skipped++
        continue
      }

      // Update payment status
      await supabase
        .from('payments')
        .update({ status: 'succeeded', hitpay_payment_id: hitpayPaymentId, updated_at: new Date().toISOString() })
        .eq('id', payment.id)

      // Create user_package (issue tokens)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + (pkg.validity_days as number))

      const { data: userPackage, error: upError } = await supabase
        .from('user_packages')
        .insert({
          user_id: payment.user_id,
          package_id: payment.package_id,
          payment_id: String(payment.id),
          tokens_remaining: pkg.token_count as number,
          tokens_held: 0,
          expires_at: expiresAt.toISOString(),
          status: 'active',
        })
        .select()
        .single()

      if (upError || !userPackage) {
        console.error(`[Cron: SyncPendingPayments] Failed to create user_package for payment ${payment.id}:`, upError)
        skipped++
        continue
      }

      // Token transaction log
      await supabase.from('token_transactions').insert({
        user_id: payment.user_id,
        user_package_id: userPackage.id,
        transaction_type: 'purchase',
        tokens_change: pkg.token_count as number,
        tokens_before: 0,
        tokens_after: pkg.token_count as number,
        description: `Purchased ${pkg.name} (cron sync)`,
        created_at: new Date().toISOString(),
      })

      // Record promo usage if applicable
      if (payment.promo_type && payment.discount_percent && (payment.discount_percent as number) > 0) {
        await supabase.from('promo_usage').insert({
          user_id: payment.user_id,
          promo_type: payment.promo_type,
          discount_percent: payment.discount_percent,
          discount_amount_cents: payment.discount_amount_cents || 0,
          package_id: payment.package_id,
          payment_id: payment.id,
        })
      }

      console.log(`[Cron: SyncPendingPayments] Synced payment ${payment.id} — issued ${pkg.token_count} tokens to user ${payment.user_id}`)

      void Promise.resolve().then(async () => {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('email, name')
          .eq('id', payment.user_id)
          .maybeSingle()

        await sendAdminEmail('payment-alert', {
          paymentId: payment.id,
          paymentType: 'package-purchase',
          source: 'cron-sync',
          amount: payment.amount_cents / 100,
          currency: payment.currency,
          packageName: pkg.name,
          tokenCount: pkg.token_count,
          userName: userProfile?.name || 'User',
          userEmail: userProfile?.email || undefined,
        })
      }).catch((alertError: unknown) => {
        console.error(`[Cron: SyncPendingPayments] Non-critical: failed to send payment alert for ${payment.id}:`, alertError)
      })

      synced++
    } catch (err) {
      console.error(`[Cron: SyncPendingPayments] Unexpected error for payment ${payment.id}:`, err)
      skipped++
    }
  }

  return { synced, failed, skipped, total: pendingPayments.length }
}

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
      {
        name: 'syncPendingHitPayPayments',
        description: 'Polls HitPay for pending payments and auto-issues tokens when confirmed',
        frequency: 'Every 15 minutes',
        cron: '*/15 * * * *',
      },
    ],
  }
}
