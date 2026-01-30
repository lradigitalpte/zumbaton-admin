/**
 * Dashboard API
 * GET /api/dashboard - Get all dashboard data
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    
    // Calculate date ranges
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Fetch all dashboard data in parallel
    const [
      // Total members (customers with role='user')
      totalMembersResult,
      totalMembersLastMonth,
      
      // Tokens sold this month
      tokensSoldThisMonth,
      tokensSoldLastMonth,
      
      // Today's classes and attendance
      todaysClasses,
      todaysBookings,
      todaysAttendance,
      
      // Revenue this month
      revenueThisMonth,
      revenueLastMonth,
      
      // Recent activity
      recentBookings,
      recentAttendance,
      recentPayments,
      recentCancellations,
    ] = await Promise.all([
      // Total members (customers with role='user')
      supabase
        .from(TABLES.USER_PROFILES)
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user'),
      
      // Members created before this month (for comparison)
      supabase
        .from(TABLES.USER_PROFILES)
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .lt('created_at', startOfMonth.toISOString()),
      
      // Tokens sold this month (from user_packages - more reliable than token_transactions)
      supabase
        .from(TABLES.USER_PACKAGES)
        .select(`
          tokens_remaining,
          purchased_at,
          packages (
            token_count
          )
        `)
        .gte('purchased_at', startOfMonth.toISOString())
        .eq('status', 'active'),
      
      // Tokens sold last month
      supabase
        .from(TABLES.USER_PACKAGES)
        .select(`
          tokens_remaining,
          purchased_at,
          packages (
            token_count
          )
        `)
        .gte('purchased_at', startOfLastMonth.toISOString())
        .lt('purchased_at', startOfMonth.toISOString())
        .eq('status', 'active'),
      
      // Today's classes (exclude cancelled)
      supabase
        .from(TABLES.CLASSES)
        .select(`
          id,
          title,
          scheduled_at,
          duration_minutes,
          capacity,
          status,
          instructor_id,
          instructor_name
        `)
        .gte('scheduled_at', startOfToday.toISOString())
        .lte('scheduled_at', endOfToday.toISOString())
        .neq('status', 'cancelled')
        .order('scheduled_at', { ascending: true }),
      
      // Today's bookings for all classes
      supabase
        .from(TABLES.BOOKINGS)
        .select('id, class_id, user_id, status')
        .gte('booked_at', startOfToday.toISOString())
        .lte('booked_at', endOfToday.toISOString()),
      
      // Today's attendance (check-ins)
      supabase
        .from(TABLES.ATTENDANCES)
        .select('id, booking_id')
        .gte('checked_in_at', startOfToday.toISOString())
        .lte('checked_in_at', endOfToday.toISOString()),
      
      // Revenue this month
      supabase
        .from(TABLES.PAYMENTS)
        .select('amount_cents')
        .eq('status', 'succeeded')
        .gte('created_at', startOfMonth.toISOString()),
      
      // Revenue last month
      supabase
        .from(TABLES.PAYMENTS)
        .select('amount_cents')
        .eq('status', 'succeeded')
        .gte('created_at', startOfLastMonth.toISOString())
        .lt('created_at', startOfMonth.toISOString()),
      
      // Recent bookings (last 24 hours) - include guest info for trial bookings
      supabase
        .from(TABLES.BOOKINGS)
        .select(`
          id,
          user_id,
          status,
          booked_at,
          guest_name,
          is_trial_booking,
          classes (
            id,
            title,
            scheduled_at
          )
        `)
        .gte('booked_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .order('booked_at', { ascending: false })
        .limit(10),
      
      // Recent check-ins (last 24 hours)
      supabase
        .from(TABLES.ATTENDANCES)
        .select(`
          id,
          checked_in_at,
          bookings (
            id,
            user_id,
            classes (
              id,
              title
            )
          )
        `)
        .gte('checked_in_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .order('checked_in_at', { ascending: false })
        .limit(10),
      
      // Recent payments (last 24 hours) - include trial booking info
      supabase
        .from(TABLES.PAYMENTS)
        .select(`
          id,
          user_id,
          amount_cents,
          created_at,
          metadata,
          is_trial_booking,
          class_id,
          packages (
            id,
            name,
            token_count
          )
        `)
        .eq('status', 'succeeded')
        .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Recent cancellations (last 24 hours)
      supabase
        .from(TABLES.BOOKINGS)
        .select(`
          id,
          user_id,
          booked_at,
          classes (
            id,
            title
          )
        `)
        .eq('status', 'cancelled')
        .gte('updated_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: false })
        .limit(5),
    ])

    // Calculate metrics
    const totalMembers = totalMembersResult.count || 0
    const membersLastMonth = totalMembersLastMonth.count || 0
    const newMembersThisMonth = totalMembers - membersLastMonth
    const usersChange = membersLastMonth > 0 
      ? ((newMembersThisMonth / membersLastMonth) * 100)
      : 0

    // Tokens sold (from user_packages - use package token_count for accuracy)
    const tokensThisMonth = (tokensSoldThisMonth.data || []).reduce((sum, up) => {
      const pkg = Array.isArray(up.packages) ? up.packages[0] : up.packages
      return sum + (pkg?.token_count || up.tokens_remaining || 0)
    }, 0)
    const tokensLastMonth = (tokensSoldLastMonth.data || []).reduce((sum, up) => {
      const pkg = Array.isArray(up.packages) ? up.packages[0] : up.packages
      return sum + (pkg?.token_count || up.tokens_remaining || 0)
    }, 0)
    const tokensChange = tokensLastMonth > 0
      ? ((tokensThisMonth - tokensLastMonth) / tokensLastMonth * 100)
      : 0

    // Today's attendance
    const classesToday = (todaysClasses.data || []).length
    const attendanceToday = (todaysAttendance.data || []).length
    const totalBookingsToday = (todaysBookings.data || []).filter(b => b.status !== 'cancelled').length
    const attendanceRate = totalBookingsToday > 0 
      ? Math.round((attendanceToday / totalBookingsToday) * 100)
      : 0

    // Revenue
    const revenueThisMonthTotal = (revenueThisMonth.data || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
    const revenueLastMonthTotal = (revenueLastMonth.data || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100
    const revenueChange = revenueLastMonthTotal > 0
      ? ((revenueThisMonthTotal - revenueLastMonthTotal) / revenueLastMonthTotal * 100)
      : 0

    // Format today's classes
    const classes = (todaysClasses.data || []).map(cls => {
      const classBookings = (todaysBookings.data || []).filter(b => b.class_id === cls.id && b.status !== 'cancelled')
      const classAttendance = (todaysAttendance.data || []).filter(a => {
        const booking = classBookings.find(b => b.id === (a as { booking_id?: string }).booking_id)
        return !!booking
      })
      
      // Determine status based on time
      const scheduledTime = new Date(cls.scheduled_at)
      const endTime = new Date(scheduledTime.getTime() + (cls.duration_minutes || 60) * 60 * 1000)
      
      let status: 'upcoming' | 'in-progress' | 'completed' = 'upcoming'
      if (cls.status === 'completed') {
        status = 'completed'
      } else if (now >= scheduledTime && now <= endTime) {
        status = 'in-progress'
      } else if (now > endTime) {
        status = 'completed'
      }

      return {
        id: cls.id,
        title: cls.title,
        instructor: cls.instructor_name || 'TBD',
        time: scheduledTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore' }),
        capacity: cls.capacity || 20,
        booked: classBookings.length,
        checkedIn: classAttendance.length,
        status,
      }
    })

    // Get user IDs for recent activity (only for registered users)
    const allUserIds = new Set<string>()
    for (const b of recentBookings.data || []) if (b.user_id) allUserIds.add(b.user_id)
    for (const a of recentAttendance.data || []) {
      const booking = a.bookings as { user_id?: string } | null
      if (booking?.user_id) allUserIds.add(booking.user_id)
    }
    for (const p of recentPayments.data || []) if (p.user_id) allUserIds.add(p.user_id)
    for (const c of recentCancellations.data || []) if (c.user_id) allUserIds.add(c.user_id)

    // Fetch user profiles
    const userIds = Array.from(allUserIds)
    const { data: userProfiles } = userIds.length > 0
      ? await supabase.from(TABLES.USER_PROFILES).select('id, name').in('id', userIds)
      : { data: [] }
    
    const userMap: Record<string, string> = {}
    for (const u of userProfiles || []) {
      userMap[u.id] = u.name
    }

    // Guest bookings map is built from the booking data itself (guest_name is already in the query)

    // Fetch guest info for trial payment purchases (lookup by payment_id)
    const trialPaymentIds = (recentPayments.data || [])
      .filter(p => !p.user_id && p.is_trial_booking)
      .map(p => p.id)
    const trialPaymentBookingsMap: Record<string, string> = {}
    if (trialPaymentIds.length > 0) {
      const { data: trialBookings } = await supabase
        .from(TABLES.BOOKINGS)
        .select('guest_name, payment_id')
        .in('payment_id', trialPaymentIds)
        .eq('is_trial_booking', true)
      for (const tb of trialBookings || []) {
        if (tb.payment_id && tb.guest_name) {
          trialPaymentBookingsMap[tb.payment_id] = tb.guest_name
        }
      }
    }

    // Format recent activity
    const activities: Array<{
      id: string
      type: 'booking' | 'check-in' | 'cancellation' | 'purchase' | 'no-show'
      user: string
      description: string
      time: string
      timestamp: number
    }> = []

    // Add check-ins
    for (const a of recentAttendance.data || []) {
      const booking = a.bookings as { user_id?: string; classes?: { title?: string } | { title?: string }[] } | null
      const classData = booking?.classes
      const cls = Array.isArray(classData) ? classData[0] : classData
      const userId = booking?.user_id || ''
      activities.push({
        id: `checkin-${a.id}`,
        type: 'check-in',
        user: userMap[userId] || 'Unknown',
        description: `Checked in to ${cls?.title || 'class'}`,
        time: getRelativeTime(new Date(a.checked_in_at)),
        timestamp: new Date(a.checked_in_at).getTime(),
      })
    }

    // Add bookings
    for (const b of recentBookings.data || []) {
      if (b.status === 'cancelled') continue
      const classData = b.classes as { title?: string; scheduled_at?: string } | { title?: string; scheduled_at?: string }[] | null
      const cls = Array.isArray(classData) ? classData[0] : classData
      const classTime = cls?.scheduled_at 
        ? new Date(cls.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore' })
        : ''
      
      // Get user name: registered user from userMap, or guest name for trial bookings
      let userName = 'Unknown'
      if (b.user_id) {
        userName = userMap[b.user_id] || 'Unknown'
      } else if ((b as any).guest_name) {
        userName = (b as any).guest_name
      }
      
      activities.push({
        id: `booking-${b.id}`,
        type: 'booking',
        user: userName,
        description: `Booked ${cls?.title || 'class'}${classTime ? ` (${classTime})` : ''}`,
        time: getRelativeTime(new Date(b.booked_at)),
        timestamp: new Date(b.booked_at).getTime(),
      })
    }

    // Add purchases
    for (const p of recentPayments.data || []) {
      const packagesData = p.packages as { name?: string; token_count?: number } | { name?: string; token_count?: number }[] | null
      const pkg = Array.isArray(packagesData) ? packagesData[0] : packagesData
      // Use metadata first (what was stored at payment time), then fallback to package join
      const metadata = p.metadata as { package_name?: string; token_count?: number; guest_name?: string } | null
      const packageName = metadata?.package_name || pkg?.name || 'package'
      // Prioritize metadata token_count (actual purchase) over package token_count (current value)
      const tokenCount = metadata?.token_count ?? pkg?.token_count ?? 0
      
      // Get user name: registered user from userMap, or guest name for trial bookings
      let userName = 'Unknown'
      if (p.user_id) {
        userName = userMap[p.user_id] || 'Unknown'
      } else if (p.is_trial_booking && trialPaymentBookingsMap[p.id]) {
        userName = trialPaymentBookingsMap[p.id]
      } else if (metadata?.guest_name) {
        userName = metadata.guest_name
      }
      
      activities.push({
        id: `purchase-${p.id}`,
        type: 'purchase',
        user: userName,
        description: `Purchased ${packageName}${tokenCount ? ` (${tokenCount} tokens)` : ''}`,
        time: getRelativeTime(new Date(p.created_at)),
        timestamp: new Date(p.created_at).getTime(),
      })
    }

    // Add cancellations
    for (const c of recentCancellations.data || []) {
      const classData = c.classes as { title?: string } | { title?: string }[] | null
      const cls = Array.isArray(classData) ? classData[0] : classData
      activities.push({
        id: `cancel-${c.id}`,
        type: 'cancellation',
        user: userMap[c.user_id] || 'Unknown',
        description: `Cancelled ${cls?.title || 'class'} booking`,
        time: getRelativeTime(new Date(c.booked_at)),
        timestamp: new Date(c.booked_at).getTime(),
      })
    }

    // Sort by timestamp and take top 10
    activities.sort((a, b) => b.timestamp - a.timestamp)
    const recentActivity = activities.slice(0, 10).map(({ timestamp, ...rest }) => rest)

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          activeMembers: totalMembers,
          usersChange: Number(usersChange.toFixed(1)),
          tokensSold: tokensThisMonth,
          tokensChange: Number(tokensChange.toFixed(1)),
          classesToday,
          attendanceToday,
          attendanceRate,
          revenue: Math.round(revenueThisMonthTotal),
          revenueChange: Number(revenueChange.toFixed(1)),
        },
        todaysClasses: classes,
        recentActivity,
      },
    })
  } catch (error) {
    console.error('[Dashboard API] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch dashboard data' } },
      { status: 500 }
    )
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}
