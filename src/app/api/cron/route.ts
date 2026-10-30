// Cron Job API Route
// Endpoint for running scheduled jobs (can be called by Vercel Cron or similar)

import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  runAllScheduledJobs,
  runExpiredPackagesJob,
  runFrozenPackagesJob,
  runNoShowsJob,
  runWaitlistExpiryJob,
  sendTokenExpiryWarnings,
  sendTokenBalanceLowWarnings,
  sendClassReminders,
  sendStreakReminders,
  sendBirthdayWishes,
  markCompletedClasses,
  runAutoGenerateClassesJob,
  runSyncPendingPaymentsJob,
  runCheckoutRemindersJob,
  runProcessLeadOutreachJob,
  getJobSchedule,
} from '@/services/scheduled-jobs.service'
import { processLeadOutreachQueue } from '@/services/lead-outreach.service'
import { ApiError } from '@/lib/api-error'
import { getAuthenticatedUser, hasRequiredRole } from '@/middleware/rbac'

// Vercel function time limit for scheduled jobs (seconds)
export const maxDuration = 60

// GET /api/cron — schedule info, or run a job when ?job=… and Authorization is set (cron-job.org often uses GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const job = searchParams.get('job')

    if (!job) {
      const schedule = getJobSchedule()
      return NextResponse.json({
        success: true,
        data: schedule,
        hint: 'To run a job, use POST or GET with ?job=<name> and header Authorization: Bearer <CRON_SECRET>',
      })
    }

    return await executeCronJob(request, job)
  } catch (error) {
    return handleApiError(error)
  }
}

type CronAuth = 'secret' | 'admin' | 'dev'

async function authorizeCronRequest(request: NextRequest): Promise<CronAuth> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Supabase pg_cron / external scheduler
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return 'secret'
  }

  // Settings UI: logged-in admin running a job manually
  const user = await getAuthenticatedUser(request)
  if (user && hasRequiredRole(user.role, 'admin')) {
    return 'admin'
  }

  // Local dev when CRON_SECRET is not configured
  if (!cronSecret) {
    return 'dev'
  }

  throw new ApiError('AUTHENTICATION_ERROR', 'Invalid cron secret', 401)
}

/** External schedulers (cron-job.org) use short HTTP timeouts; run heavy jobs in after(). */
async function executeCronJob(request: NextRequest, job: string) {
  const auth = await authorizeCronRequest(request)

  if (job === 'streak-reminders' && auth === 'secret') {
    after(async () => {
      try {
        const result = await sendStreakReminders()
        console.log('[Cron] streak-reminders completed', JSON.stringify(result))
      } catch (err) {
        console.error('[Cron] streak-reminders failed', err)
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        accepted: true,
        job: 'streak-reminders',
        message:
          'Streak reminders started in the background (cron-job.org will see success immediately). Check Vercel logs for sendStreakReminders.',
      },
    })
  }

  return runCronJobs(job)
}

async function runCronJobs(job: string | null) {
  let results

  switch (job) {
    case 'expired-packages':
      results = [await runExpiredPackagesJob()]
      break
    case 'frozen-packages':
      results = [await runFrozenPackagesJob()]
      break
    case 'no-shows':
      results = [await runNoShowsJob()]
      break
    case 'waitlist-expiry':
      results = [await runWaitlistExpiryJob()]
      break
    case 'token-warnings':
      results = [await sendTokenExpiryWarnings()]
      break
    case 'token-balance':
      results = [await sendTokenBalanceLowWarnings()]
      break
    case 'class-reminders':
      results = [await sendClassReminders()]
      break
    case 'streak-reminders':
      results = [await sendStreakReminders()]
      break
    case 'birthday-wishes':
      results = [await sendBirthdayWishes()]
      break
    case 'mark-completed-classes':
      results = [await markCompletedClasses()]
      break
    case 'generate-future-classes':
      results = [await runAutoGenerateClassesJob()]
      break
    case 'sync-pending-payments':
      results = [await runSyncPendingPaymentsJob(), await runCheckoutRemindersJob()]
      break
    case 'checkout-reminders':
      results = [await runCheckoutRemindersJob()]
      break
    case 'process-lead-outreach':
      results = [await runProcessLeadOutreachJob()]
      break
    case 'all':
    default:
      results = await runAllScheduledJobs()
      break
  }

  const summary = {
    totalJobs: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    totalDuration: results.reduce((acc, r) => acc + r.duration, 0),
  }

  return NextResponse.json({
    success: true,
    data: {
      results,
      summary,
    },
  })
}

// POST /api/cron - Run scheduled jobs
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const job = searchParams.get('job')
    if (!job) {
      await authorizeCronRequest(request)
      return runCronJobs(null)
    }
    return await executeCronJob(request, job)
  } catch (error) {
    return handleApiError(error)
  }
}

// Error handler helper
function handleApiError(error: unknown) {
  console.error('[API /cron]', error)

  if (error instanceof ApiError) {
    return NextResponse.json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    }, { status: error.statusCode })
  }

  return NextResponse.json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  }, { status: 500 })
}
