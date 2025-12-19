// Debug No-Shows API Route
// Allows admins to view pending no-shows and manually process them

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { processNoShows, markNoShow } from '@/services/attendance.service'
import { ApiError } from '@/lib/api-error'

// GET /api/attendance/debug-no-shows - View pending no-shows (admin only)
async function handleGetDebugNoShows(
  request: NextRequest,
  context: { user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const adminClient = getSupabaseAdminClient()
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (action === 'pending') {
      // Get all confirmed bookings where class has ended
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

      const { data: bookings, error } = await adminClient
        .from('bookings')
        .select(`
          id,
          user_id,
          status,
          tokens_used,
          created_at,
          user:user_profiles!user_id(id, name, email),
          class:classes!class_id(
            id,
            title,
            scheduled_at,
            duration_minutes,
            instructor_id,
            instructor:user_profiles!instructor_id(name)
          )
        `)
        .eq('status', 'confirmed')
        .order('class.scheduled_at', { ascending: false })

      if (error) {
        throw new ApiError('SERVER_ERROR', 'Failed to fetch bookings', 500, error)
      }

      // Filter for classes that ended 30+ minutes ago
      const now = new Date()
      const pendingNoShows = (bookings || []).filter(booking => {
        const classData = booking.class as any
        if (!classData) return false

        const classEndTime = new Date(
          new Date(classData.scheduled_at).getTime() +
          classData.duration_minutes * 60 * 1000
        )
        const graceEndTime = new Date(classEndTime.getTime() + 30 * 60 * 1000)
        return now > graceEndTime
      })

      // Map to detailed format
      const mappedNoShows = pendingNoShows.map(booking => {
        const classData = booking.class as any
        const userData = booking.user as any
        const classEndTime = new Date(
          new Date(classData.scheduled_at).getTime() +
          classData.duration_minutes * 60 * 1000
        )
        const minutesSinceEnd = Math.floor((now.getTime() - classEndTime.getTime()) / 60000)

        return {
          bookingId: booking.id,
          userId: booking.user_id,
          userName: userData?.name || 'Unknown',
          userEmail: userData?.email || 'Unknown',
          className: classData.title,
          classTime: classData.scheduled_at,
          duration: classData.duration_minutes,
          classEndTime: classEndTime.toISOString(),
          minutesSinceEnd,
          tokensUsed: booking.tokens_used,
          bookingCreatedAt: booking.created_at,
          instructorName: (classData.instructor as any)?.name || 'Unknown',
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          pending: mappedNoShows,
          count: mappedNoShows.length,
          message: `Found ${mappedNoShows.length} pending no-shows (classes ended 30+ min ago)`,
        },
      })
    }

    if (action === 'stats') {
      // Get no-show statistics
      const { data: noShowBookings, error: noShowError } = await adminClient
        .from('bookings')
        .select(`
          id,
          user_id,
          user:user_profiles!user_id(id, name, email)
        `)
        .eq('status', 'no-show')

      if (noShowError) {
        throw new ApiError('SERVER_ERROR', 'Failed to fetch statistics', 500, noShowError)
      }

      // Count no-shows per user
      const noShowStats: Record<string, { name: string; email: string; count: number }> = {}
      ;(noShowBookings || []).forEach(booking => {
        const userData = booking.user as any
        const userId = booking.user_id
        if (!noShowStats[userId]) {
          noShowStats[userId] = {
            name: userData?.name || 'Unknown',
            email: userData?.email || 'Unknown',
            count: 0,
          }
        }
        noShowStats[userId].count++
      })

      // Convert to array and sort by count
      const stats = Object.entries(noShowStats)
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.count - a.count)

      return NextResponse.json({
        success: true,
        data: {
          stats,
          totalNoShows: noShowBookings?.length || 0,
          usersWithNoShows: stats.length,
          flaggedUsers: stats.filter(s => s.count >= 3).length,
        },
      })
    }

    // Default: return both pending and stats
    const { data: bookings } = await adminClient
      .from('bookings')
      .select(`
        id,
        user_id,
        status,
        tokens_used,
        created_at,
        user:user_profiles!user_id(id, name, email),
        class:classes!class_id(
          id,
          title,
          scheduled_at,
          duration_minutes,
          instructor_id,
          instructor:user_profiles!instructor_id(name)
        )
      `)
      .eq('status', 'confirmed')

    const now = new Date()
    const pendingNoShows = (bookings || []).filter(booking => {
      const classData = booking.class as any
      if (!classData) return false
      const classEndTime = new Date(
        new Date(classData.scheduled_at).getTime() +
        classData.duration_minutes * 60 * 1000
      )
      const graceEndTime = new Date(classEndTime.getTime() + 30 * 60 * 1000)
      return now > graceEndTime
    })

    return NextResponse.json({
      success: true,
      data: {
        pending: {
          count: pendingNoShows.length,
          message: 'Classes ended 30+ minutes ago but not marked as no-show',
        },
        info: 'Use ?action=pending for full pending list or ?action=stats for statistics',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/attendance/debug-no-shows - Manually process no-shows (admin only)
async function handlePostDebugNoShows(
  request: NextRequest,
  context: { user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { action, bookingId } = body

    if (action === 'process-all') {
      // Run the full no-show processing job
      const result = await processNoShows()
      return NextResponse.json({
        success: true,
        data: {
          processed: result.processed,
          failed: result.failed,
          message: `Processed ${result.processed} no-shows (${result.failed} failed)`,
        },
      })
    }

    if (action === 'mark-single' && bookingId) {
      // Manually mark a single booking as no-show
      const result = await markNoShow({
        bookingId,
        markedBy: context.user.id,
        notes: 'Manually marked by admin',
      })

      return NextResponse.json({
        success: true,
        data: {
          message: 'Booking marked as no-show',
          userNoShowCount: result.userNoShowCount,
          userFlagged: result.userFlagged,
        },
      })
    }

    throw new ApiError('VALIDATION_ERROR', 'Invalid action or missing bookingId', 400)
  } catch (error) {
    return handleApiError(error)
  }
}

// Use withAuth middleware to ensure user is authenticated
export const GET = withAuth(handleGetDebugNoShows, { requiredRole: 'admin' })
export const POST = withAuth(handlePostDebugNoShows, { requiredRole: 'admin' })

// Error handler helper
function handleApiError(error: unknown) {
  console.error('[API /attendance/debug-no-shows]', error)

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
