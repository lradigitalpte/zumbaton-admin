// Detailed No-Show Debugging Endpoint
// Shows exactly why a booking was/wasn't marked as no-show

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { ApiError } from '@/lib/api-error'

async function handleGetDebug(
  request: NextRequest,
  context: { user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const adminClient = getSupabaseAdminClient()
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const bookingId = url.searchParams.get('bookingId')

    if (!userId && !bookingId) {
      throw new ApiError('VALIDATION_ERROR', 'Provide either userId or bookingId', 400)
    }

    const now = new Date()

    // If userId provided, show all bookings for that user
    if (userId) {
      const { data: bookings, error } = await adminClient
        .from('bookings')
        .select(`
          id,
          status,
          tokens_used,
          created_at,
          user_id,
          class:classes!class_id(
            id,
            title,
            scheduled_at,
            duration_minutes
          )
        `)
        .eq('user_id', userId)
        .order('class.scheduled_at', { ascending: false })

      if (error) throw error

      const bookingAnalysis = (bookings || []).map((booking: any) => {
        const classData = booking.class
        const classStartTime = new Date(classData.scheduled_at)
        const classEndTime = new Date(
          classStartTime.getTime() + classData.duration_minutes * 60 * 1000
        )
        const graceEndTime = new Date(classEndTime.getTime() + 30 * 60 * 1000)

        const isClassEnded = now > classEndTime
        const isGracePeriodEnded = now > graceEndTime
        const minutesUntilEnd = Math.round((classEndTime.getTime() - now.getTime()) / 60000)
        const minutesSinceEnd = Math.round((now.getTime() - classEndTime.getTime()) / 60000)
        const minutesSinceGraceEnd = Math.round((now.getTime() - graceEndTime.getTime()) / 60000)

        let reason = ''
        if (booking.status === 'attended') {
          reason = 'Already marked as ATTENDED ✓'
        } else if (booking.status === 'no-show') {
          reason = 'Already marked as NO-SHOW ✗'
        } else if (booking.status === 'cancelled') {
          reason = 'Booking was CANCELLED'
        } else if (booking.status !== 'confirmed') {
          reason = `Status is ${booking.status} (not "confirmed")`
        } else if (!isClassEnded) {
          reason = `Class hasn't ended yet (ends in ${minutesUntilEnd} min)`
        } else if (!isGracePeriodEnded) {
          reason = `Grace period still active (${30 - Math.abs(minutesSinceEnd)} min left)`
        } else {
          reason = 'SHOULD BE MARKED AS NO-SHOW ⚠️'
        }

        return {
          bookingId: booking.id,
          status: booking.status,
          className: classData.title,
          classStartTime: classStartTime.toISOString(),
          classEndTime: classEndTime.toISOString(),
          graceEndTime: graceEndTime.toISOString(),
          currentTime: now.toISOString(),
          isClassEnded,
          isGracePeriodEnded,
          minutesUntilEnd: minutesUntilEnd > 0 ? minutesUntilEnd : 0,
          minutesSinceEnd: minutesSinceEnd > 0 ? minutesSinceEnd : 0,
          minutesSinceGraceEnd: minutesSinceGraceEnd > 0 ? minutesSinceGraceEnd : 0,
          tokensUsed: booking.tokens_used,
          reason,
          wouldBeNoShow: booking.status === 'confirmed' && isGracePeriodEnded,
        }
      })

      // Get token transaction history
      const { data: transactions } = await adminClient
        .from('token_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      const noShowTransactions = (transactions || []).filter((t: any) =>
        t.description?.includes('no-show') || t.transaction_type === 'no-show-consume'
      )

      return NextResponse.json({
        success: true,
        data: {
          userId,
          bookingAnalysis,
          noShowStats: {
            totalBookings: bookings?.length || 0,
            attendedCount: bookings?.filter((b: any) => b.status === 'attended').length || 0,
            noShowCount: bookings?.filter((b: any) => b.status === 'no-show').length || 0,
            confirmedCount: bookings?.filter((b: any) => b.status === 'confirmed').length || 0,
            cancelledCount: bookings?.filter((b: any) => b.status === 'cancelled').length || 0,
          },
          recentNoShowTokens: noShowTransactions.map((t: any) => ({
            id: t.id,
            type: t.transaction_type,
            tokensDeducted: t.tokens_change,
            description: t.description,
            createdAt: t.created_at,
          })),
        },
      })
    }

    // If bookingId provided, show detailed analysis of that booking
    if (bookingId) {
      const { data: booking, error } = await adminClient
        .from('bookings')
        .select(`
          *,
          class:classes!class_id(*),
          user:user_profiles!user_id(name, email)
        `)
        .eq('id', bookingId)
        .single()

      if (error || !booking) {
        throw new ApiError('NOT_FOUND_ERROR', 'Booking not found', 404)
      }

      const classData = booking.class
      const classStartTime = new Date(classData.scheduled_at)
      const classEndTime = new Date(
        classStartTime.getTime() + classData.duration_minutes * 60 * 1000
      )
      const graceEndTime = new Date(classEndTime.getTime() + 30 * 60 * 1000)

      const isClassEnded = now > classEndTime
      const isGracePeriodEnded = now > graceEndTime
      const minutesUntilEnd = Math.round((classEndTime.getTime() - now.getTime()) / 60000)
      const minutesSinceEnd = Math.round((now.getTime() - classEndTime.getTime()) / 60000)
      const minutesSinceGraceEnd = Math.round((now.getTime() - graceEndTime.getTime()) / 60000)

      // Get attendance record if it exists
      const { data: attendance } = await adminClient
        .from('attendances')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        data: {
          booking: {
            id: booking.id,
            status: booking.status,
            tokensUsed: booking.tokens_used,
            createdAt: booking.created_at,
          },
          user: {
            id: booking.user_id,
            name: booking.user?.name,
            email: booking.user?.email,
          },
          class: {
            id: classData.id,
            title: classData.title,
            startTime: classStartTime.toISOString(),
            endTime: classEndTime.toISOString(),
            durationMinutes: classData.duration_minutes,
          },
          timeline: {
            classStartTime: classStartTime.toISOString(),
            classEndTime: classEndTime.toISOString(),
            graceEndTime: graceEndTime.toISOString(),
            currentTime: now.toISOString(),
          },
          status: {
            isClassEnded,
            isGracePeriodEnded,
            minutesUntilEnd: minutesUntilEnd > 0 ? minutesUntilEnd : 0,
            minutesSinceEnd: minutesSinceEnd > 0 ? minutesSinceEnd : 0,
            minutesSinceGraceEnd: minutesSinceGraceEnd > 0 ? minutesSinceGraceEnd : 0,
          },
          attendance: attendance ? {
            checkedInAt: attendance.checked_in_at,
            checkInMethod: attendance.check_in_method,
            checkedInBy: attendance.checked_in_by,
            notes: attendance.notes,
          } : null,
          analysis: {
            wouldBeNoShow: booking.status === 'confirmed' && isGracePeriodEnded,
            reason: getReason(booking.status, isClassEnded, isGracePeriodEnded, minutesUntilEnd, minutesSinceEnd),
            checklist: {
              'Booking status is "confirmed"': booking.status === 'confirmed',
              'Class has ended': isClassEnded,
              'Grace period (30 min) has passed': isGracePeriodEnded,
              'No attendance record exists': !attendance,
            },
          },
        },
      })
    }

    throw new ApiError('VALIDATION_ERROR', 'No valid parameters provided', 400)
  } catch (error) {
    return handleApiError(error)
  }
}

function getReason(
  status: string,
  isClassEnded: boolean,
  isGracePeriodEnded: boolean,
  minutesUntilEnd: number,
  minutesSinceEnd: number
): string {
  if (status === 'attended') return 'User checked in ✓'
  if (status === 'no-show') return 'Already marked as no-show'
  if (status === 'cancelled') return 'Booking was cancelled'
  if (status !== 'confirmed') return `Wrong status: ${status}`
  if (!isClassEnded) return `Class ends in ${minutesUntilEnd} minutes`
  if (!isGracePeriodEnded) return `Grace period active (${30 - Math.abs(minutesSinceEnd)} min left)`
  return 'Ready to be marked as no-show'
}

export const GET = withAuth(handleGetDebug, { requiredRole: 'admin' })

function handleApiError(error: unknown) {
  console.error('[API /attendance/debug-detailed]', error)

  if (error instanceof ApiError) {
    return NextResponse.json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
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
