import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/attendance/issues - Get all attendance issues with filters
export async function GET(request: NextRequest) {
  try {
    const adminClient = getSupabaseAdminClient()
    const { searchParams } = new URL(request.url)
    
    const type = searchParams.get('type') // no-show, late-cancel, early-cancel, expired
    const status = searchParams.get('status') // pending, excused, penalized, resolved
    const dateRange = searchParams.get('dateRange') // today, week, month, all
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Build query - get bookings with problem statuses
    // Join with classes (which has instructor_id -> user_profiles)
    let query = adminClient
      .from(TABLES.BOOKINGS)
      .select(`
        id,
        user_id,
        class_id,
        status,
        tokens_used,
        booked_at,
        cancelled_at,
        cancellation_reason,
        created_at,
        updated_at,
        class:classes(
          id,
          title,
          scheduled_at,
          duration_minutes,
          instructor_id
        )
      `, { count: 'exact' })
      .in('status', ['no-show', 'cancelled-late', 'cancelled'])

    // Apply type filter
    if (type && type !== 'all') {
      const statusMap: Record<string, string[]> = {
        'no-show': ['no-show'],
        'late-cancel': ['cancelled-late'],
        'early-cancel': ['cancelled'],
      }
      if (statusMap[type]) {
        query = query.in('status', statusMap[type])
      }
    }

    // Apply date filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date()
      let startDate: Date

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0))
          break
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7))
          break
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1))
          break
        default:
          startDate = new Date(0)
      }
      
      query = query.gte('created_at', startDate.toISOString())
    }

    // Order and paginate
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: bookings, error, count } = await query

    if (error) {
      console.error('[AttendanceIssues] Error fetching issues:', error)
      return NextResponse.json(
        { error: 'Failed to fetch attendance issues' },
        { status: 500 }
      )
    }

    // Get user profiles for all users in bookings
    const userIds = [...new Set(bookings?.map(b => b.user_id) || [])]
    
    const { data: userProfiles } = await adminClient
      .from(TABLES.USER_PROFILES)
      .select('id, name, email, phone')
      .in('id', userIds)

    const userProfileMap: Record<string, { name: string; email: string; phone: string }> = {}
    userProfiles?.forEach(profile => {
      userProfileMap[profile.id] = {
        name: profile.name,
        email: profile.email,
        phone: profile.phone || '',
      }
    })

    // Get instructor profiles
    const instructorIds = [...new Set(
      bookings?.map(b => {
        const classData = Array.isArray(b.class) 
          ? (b.class[0] as { instructor_id: string } | undefined)
          : (b.class as { instructor_id: string } | null | undefined)
        return classData?.instructor_id
      }).filter(Boolean) || []
    )] as string[]

    const { data: instructorProfiles } = await adminClient
      .from(TABLES.USER_PROFILES)
      .select('id, name')
      .in('id', instructorIds)

    const instructorMap: Record<string, string> = {}
    instructorProfiles?.forEach(profile => {
      instructorMap[profile.id] = profile.name
    })

    // Get no-show counts for each user
    const { data: noShowCounts } = await adminClient
      .from(TABLES.BOOKINGS)
      .select('user_id')
      .in('user_id', userIds)
      .eq('status', 'no-show')

    const noShowCountMap: Record<string, number> = {}
    noShowCounts?.forEach(item => {
      noShowCountMap[item.user_id] = (noShowCountMap[item.user_id] || 0) + 1
    })

    // Check if attendance_issues table exists and get resolution status
    let issueStatusMap: Record<string, { status: string; tokenRefunded: boolean; penaltyApplied: boolean; notes: string; resolvedAt: string | null; resolvedBy: string | null }> = {}
    
    try {
      const bookingIds = bookings?.map(b => b.id) || []
      const { data: issueStatuses } = await adminClient
        .from('attendance_issues')
        .select('booking_id, status, token_refunded, penalty_applied, notes, resolved_at, resolved_by')
        .in('booking_id', bookingIds)

      issueStatuses?.forEach(issue => {
        issueStatusMap[issue.booking_id] = {
          status: issue.status,
          tokenRefunded: issue.token_refunded,
          penaltyApplied: issue.penalty_applied,
          notes: issue.notes || '',
          resolvedAt: issue.resolved_at,
          resolvedBy: issue.resolved_by,
        }
      })
    } catch {
      // Table doesn't exist yet, use pending as default
      console.log('[AttendanceIssues] attendance_issues table not found, using defaults')
    }

    // Transform to expected format
    const issues = bookings?.map(booking => {
      // Get user from profile map
      const user = userProfileMap[booking.user_id] || null
      
      // Get class data
      const classData = Array.isArray(booking.class)
        ? (booking.class[0] as { id: string; title: string; scheduled_at: string; duration_minutes: number; instructor_id: string } | undefined)
        : (booking.class as { id: string; title: string; scheduled_at: string; duration_minutes: number; instructor_id: string } | null | undefined)
      const instructorName = classData?.instructor_id ? instructorMap[classData.instructor_id] : null
      
      const issueInfo = issueStatusMap[booking.id]

      // Determine issue type from booking status
      let issueType: string
      switch (booking.status) {
        case 'no-show':
          issueType = 'no-show'
          break
        case 'cancelled-late':
          issueType = 'late-cancel'
          break
        case 'cancelled':
          issueType = 'early-cancel'
          break
        default:
          issueType = 'no-show'
      }

      return {
        id: booking.id,
        bookingId: booking.id,
        userId: booking.user_id,
        userName: user?.name || 'Unknown User',
        userEmail: user?.email || '',
        userPhone: user?.phone || '',
        classId: booking.class_id,
        className: classData?.title || 'Unknown Class',
        classDate: classData?.scheduled_at?.split('T')[0] || '',
        classTime: classData?.scheduled_at ? new Date(classData.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        instructor: instructorName || 'Unknown',
        issueType,
        status: issueInfo?.status || 'pending',
        tokenRefunded: issueInfo?.tokenRefunded || false,
        penaltyApplied: issueInfo?.penaltyApplied || false,
        notes: issueInfo?.notes || booking.cancellation_reason || '',
        createdAt: booking.created_at,
        resolvedAt: issueInfo?.resolvedAt || null,
        resolvedBy: issueInfo?.resolvedBy || null,
        noShowCount: noShowCountMap[booking.user_id] || 0,
      }
    }) || []

    // Apply search filter client-side (after joining)
    let filteredIssues = issues
    if (search) {
      const searchLower = search.toLowerCase()
      filteredIssues = issues.filter(issue =>
        issue.userName.toLowerCase().includes(searchLower) ||
        issue.userEmail.toLowerCase().includes(searchLower) ||
        issue.className.toLowerCase().includes(searchLower)
      )
    }

    // Apply issue status filter
    if (status && status !== 'all') {
      filteredIssues = filteredIssues.filter(issue => issue.status === status)
    }

    // Calculate stats
    const stats = {
      pending: issues.filter(i => i.status === 'pending').length,
      noShows: issues.filter(i => i.issueType === 'no-show').length,
      lateCancels: issues.filter(i => i.issueType === 'late-cancel').length,
      earlyCancels: issues.filter(i => i.issueType === 'early-cancel').length,
      expired: issues.filter(i => i.issueType === 'expired').length,
      todayCount: issues.filter(i => {
        const issueDate = new Date(i.classDate)
        const today = new Date()
        return issueDate.toDateString() === today.toDateString()
      }).length,
    }

    return NextResponse.json({
      issues: filteredIssues,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('[AttendanceIssues] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/attendance/issues/:id/resolve - Resolve an issue
export async function POST(request: NextRequest) {
  try {
    const adminClient = getSupabaseAdminClient()
    const body = await request.json()
    
    const { bookingId, action, notes, resolvedBy } = body as {
      bookingId: string
      action: 'excuse' | 'penalize' | 'resolve'
      notes?: string
      resolvedBy: string
    }

    if (!bookingId || !action || !resolvedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, action, resolvedBy' },
        { status: 400 }
      )
    }

    // Get the booking
    const { data: booking, error: bookingError } = await adminClient
      .from(TABLES.BOOKINGS)
      .select('*')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      console.error('[AttendanceIssues] Booking lookup error:', bookingError)
      console.error('[AttendanceIssues] Booking ID:', bookingId)
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Get user profile separately
    let userName = 'Unknown User'
    if (booking.user_id) {
      const { data: userProfile } = await adminClient
        .from(TABLES.USER_PROFILES)
        .select('name')
        .eq('id', booking.user_id)
        .single()
      
      if (userProfile) {
        userName = userProfile.name || 'Unknown User'
      }
    }

    // Determine issue status and actions
    let issueStatus: string
    let tokenRefunded = false
    let penaltyApplied = false

    switch (action) {
      case 'excuse':
        issueStatus = 'excused'
        tokenRefunded = true
        // TODO: Actually refund the token via token.service
        break
      case 'penalize':
        issueStatus = 'penalized'
        penaltyApplied = true
        break
      case 'resolve':
        issueStatus = 'resolved'
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    // Try to upsert into attendance_issues table
    try {
      const issueType = booking.status === 'no-show' ? 'no-show' : 
                       booking.status === 'cancelled-late' ? 'late-cancel' : 
                       booking.status === 'cancelled' ? 'early-cancel' : 'no-show'

      const { error: upsertError } = await adminClient
        .from('attendance_issues')
        .upsert({
          booking_id: bookingId,
          user_id: booking.user_id,
          class_id: booking.class_id,
          issue_type: issueType,
          status: issueStatus,
          token_refunded: tokenRefunded,
          penalty_applied: penaltyApplied,
          notes: notes || null,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'booking_id',
        })

      if (upsertError) {
        console.error('[AttendanceIssues] Error upserting issue:', upsertError)
      }
    } catch (err) {
      // Table might not exist yet
      console.log('[AttendanceIssues] Could not update attendance_issues table:', err)
    }

    // If excusing, refund the token
    if (action === 'excuse' && booking.user_package_id) {
      // Get current token balance
      const { data: pkg, error: pkgError } = await adminClient
        .from(TABLES.USER_PACKAGES)
        .select('tokens_remaining')
        .eq('id', booking.user_package_id)
        .single()

      if (pkgError) {
        console.error('[AttendanceIssues] Error fetching user package:', pkgError)
      } else if (pkg) {
        // Refund token by adding back to user_package
        const { error: refundError } = await adminClient
          .from(TABLES.USER_PACKAGES)
          .update({ 
            tokens_remaining: pkg.tokens_remaining + (booking.tokens_used || 1),
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.user_package_id)

        if (refundError) {
          console.error('[AttendanceIssues] Error refunding token:', refundError)
        } else {
          // Create token transaction for audit
          const tokensRefunded = booking.tokens_used || 1
          const tokensBefore = pkg.tokens_remaining
          const tokensAfter = pkg.tokens_remaining + tokensRefunded
          
          const { error: transactionError } = await adminClient
            .from(TABLES.TOKEN_TRANSACTIONS)
            .insert({
              user_id: booking.user_id,
              user_package_id: booking.user_package_id,
              booking_id: bookingId,
              transaction_type: 'refund',
              tokens_change: tokensRefunded,
              tokens_before: tokensBefore,
              tokens_after: tokensAfter,
              description: `Token refunded - issue excused: ${notes || 'No reason provided'}`,
              performed_by: resolvedBy,
            })

          if (transactionError) {
            console.error('[AttendanceIssues] Error creating transaction record:', transactionError)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: action === 'excuse' 
        ? `Issue excused and ${booking.tokens_used} token(s) refunded to ${userName}`
        : action === 'penalize'
        ? `Issue marked as penalized for ${userName}`
        : `Issue resolved for ${userName}`,
      issue: {
        bookingId,
        status: issueStatus,
        tokenRefunded,
        penaltyApplied,
        resolvedAt: new Date().toISOString(),
        resolvedBy,
      },
    })
  } catch (error) {
    console.error('[AttendanceIssues] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
