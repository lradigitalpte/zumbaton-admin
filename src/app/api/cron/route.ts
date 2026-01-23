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
  markCompletedClasses,
  runAutoGenerateClassesJob,
  getJobSchedule,
} from '@/services/scheduled-jobs.service'
import { ApiError } from '@/lib/api-error'

// GET /api/cron - Get job schedule info
export async function GET() {
  try {
    const schedule = getJobSchedule()

    return NextResponse.json({
      success: true,
      data: schedule,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/cron - Run scheduled jobs
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      throw new ApiError('AUTHENTICATION_ERROR', 'Invalid cron secret', 401)
    }

    const { searchParams } = new URL(request.url)
    const job = searchParams.get('job')

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
      case 'mark-completed-classes':
        results = [await markCompletedClasses()]
        break
      case 'generate-future-classes':
        results = [await runAutoGenerateClassesJob()]
        break
      case 'all':
      default:
        results = await runAllScheduledJobs()
        break
    }

    const summary = {
      totalJobs: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalDuration: results.reduce((acc, r) => acc + r.duration, 0),
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary,
      },
    })
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
