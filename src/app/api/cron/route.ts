// Cron Job API Route
// Endpoint for running scheduled jobs (can be called by Vercel Cron or similar)

import { NextRequest, NextResponse } from 'next/server'
import {
  runAllScheduledJobs,
  runExpiredPackagesJob,
  runFrozenPackagesJob,
  runNoShowsJob,
  runWaitlistExpiryJob,
  sendTokenExpiryWarnings,
  sendClassReminders,
  sendStreakReminders,
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

    await authorizeCronRequest(request)
    return await runCronJobs(job)
  } catch (error) {
    return handleApiError(error)
  }
}

async function authorizeCronRequest(request: NextRequest): Promise<void> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Supabase pg_cron / external scheduler
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return
  }

  // Settings UI: logged-in admin running a job manually
  const user = await getAuthenticatedUser(request)
  if (user && hasRequiredRole(user.role, 'admin')) {
    return
  }

  // Local dev when CRON_SECRET is not configured
  if (!cronSecret) {
    return
  }

  throw new ApiError('AUTHENTICATION_ERROR', 'Invalid cron secret', 401)
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
    case 'class-reminders':
      results = [await sendClassReminders()]
      break
    case 'streak-reminders':
      results = [await sendStreakReminders()]
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
    await authorizeCronRequest(request)

    const { searchParams } = new URL(request.url)
    const job = searchParams.get('job')

    return await runCronJobs(job)
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
