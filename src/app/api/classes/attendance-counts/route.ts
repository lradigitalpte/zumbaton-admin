/**
 * Attendance Counts API Route
 * GET /api/classes/attendance-counts - Get attendance counts for multiple classes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { z } from 'zod'

const AttendanceCountsQuerySchema = z.object({
  classIds: z.string().refine(
    (val) => {
      const ids = val.split(',').filter(Boolean)
      return ids.length > 0 && ids.length <= 100 // Limit to 100 classes at a time
    },
    { message: 'classIds must be a comma-separated list of UUIDs (max 100)' }
  ),
})

/**
 * GET /api/classes/attendance-counts - Get attendance counts for classes
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const classIdsParam = searchParams.get('classIds')

    if (!classIdsParam) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'classIds parameter is required' },
        },
        { status: 400 }
      )
    }

    const parseResult = AttendanceCountsQuerySchema.safeParse({ classIds: classIdsParam })

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid classIds parameter' },
        },
        { status: 400 }
      )
    }

    const classIds = classIdsParam.split(',').filter(Boolean)
    const adminClient = getSupabaseAdminClient()

    // Get attendance counts for all classes
    // Count bookings with status 'attended' for each class
    const { data: bookings, error } = await adminClient
      .from(TABLES.BOOKINGS)
      .select('class_id, status')
      .in('class_id', classIds)
      .eq('status', 'attended')

    if (error) {
      console.error('[AttendanceCounts] Error fetching bookings:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to fetch attendance counts' },
        },
        { status: 500 }
      )
    }

    // Count attended bookings per class
    const attendanceCounts = new Map<string, number>()
    classIds.forEach(classId => {
      attendanceCounts.set(classId, 0)
    })

    bookings?.forEach(booking => {
      const classId = booking.class_id as string
      const currentCount = attendanceCounts.get(classId) || 0
      attendanceCounts.set(classId, currentCount + 1)
    })

    // Convert to array format
    const result = Array.from(attendanceCounts.entries()).map(([classId, attendedCount]) => ({
      classId,
      attendedCount,
    }))

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[AttendanceCounts] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    )
  }
}
