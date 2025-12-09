import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export const dynamic = 'force-dynamic'

interface NotificationPreferences {
  classReminders: { email: boolean; push: boolean; sms: boolean }
  studentBookings: { email: boolean; push: boolean; sms: boolean }
  cancellations: { email: boolean; push: boolean; sms: boolean }
  scheduleChanges: { email: boolean; push: boolean; sms: boolean }
  weeklyReport: { email: boolean; push: boolean; sms: boolean }
  paymentUpdates: { email: boolean; push: boolean; sms: boolean }
  systemAlerts: { email: boolean; push: boolean; sms: boolean }
  marketing: { email: boolean; push: boolean; sms: boolean }
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  classReminders: { email: true, push: true, sms: false },
  studentBookings: { email: true, push: true, sms: false },
  cancellations: { email: true, push: true, sms: false },
  scheduleChanges: { email: true, push: true, sms: false },
  weeklyReport: { email: true, push: false, sms: false },
  paymentUpdates: { email: true, push: false, sms: false },
  systemAlerts: { email: true, push: true, sms: false },
  marketing: { email: false, push: false, sms: false },
}

/**
 * GET /api/tutor/notifications
 * Get notification preferences and recent notifications
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    if (!['instructor', 'super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Instructor access required' } },
        { status: 403 }
      )
    }

    const supabase = getSupabaseAdminClient()

    // Try to get notification preferences
    const { data: prefsData } = await supabase
      .from('notification_preferences')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle()

    const preferences: NotificationPreferences = prefsData?.preferences
      ? { ...DEFAULT_PREFERENCES, ...prefsData.preferences }
      : DEFAULT_PREFERENCES

    // Get recent notifications
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)

    return NextResponse.json({
      success: true,
      data: {
        preferences,
        notifications: notifications || [],
        unreadCount: unreadCount || 0,
        categories: [
          {
            id: 'classReminders',
            title: 'Class Reminders',
            description: 'Reminders before your upcoming classes',
          },
          {
            id: 'studentBookings',
            title: 'Student Bookings',
            description: 'When students book your classes',
          },
          {
            id: 'cancellations',
            title: 'Cancellations',
            description: 'When students cancel their bookings',
          },
          {
            id: 'scheduleChanges',
            title: 'Schedule Changes',
            description: 'Updates to your class schedule',
          },
          {
            id: 'weeklyReport',
            title: 'Weekly Report',
            description: 'Summary of your weekly activity',
          },
          {
            id: 'paymentUpdates',
            title: 'Payment Updates',
            description: 'Payment and earnings notifications',
          },
          {
            id: 'systemAlerts',
            title: 'System Alerts',
            description: 'Important system notifications',
          },
          {
            id: 'marketing',
            title: 'Marketing & Promotions',
            description: 'News, tips, and special offers',
          },
        ]
      }
    })
  } catch (error) {
    console.error('Notifications fetch error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/tutor/notifications
 * Update notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    if (!['instructor', 'super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Instructor access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { preferences } = body

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { success: false, error: { message: 'Preferences object required' } },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()

    // Upsert preferences
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        preferences: { ...DEFAULT_PREFERENCES, ...preferences },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })

    if (error) {
      console.error('Error updating preferences:', error)
      
      // If table doesn't exist, return success with defaults
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          data: { message: 'Preferences saved (using defaults)', usingDefaults: true }
        })
      }
      
      return NextResponse.json(
        { success: false, error: { message: 'Failed to update preferences' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Preferences updated successfully' }
    })
  } catch (error) {
    console.error('Preferences update error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tutor/notifications
 * Mark notifications as read or perform other actions
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    if (!['instructor', 'super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Instructor access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, notificationIds } = body

    const supabase = getSupabaseAdminClient()

    if (action === 'mark_read') {
      if (notificationIds && Array.isArray(notificationIds)) {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .in('id', notificationIds)
      } else {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
      }

      return NextResponse.json({
        success: true,
        data: { message: 'Notifications marked as read' }
      })
    }

    if (action === 'delete') {
      if (notificationIds && Array.isArray(notificationIds)) {
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', user.id)
          .in('id', notificationIds)
      }

      return NextResponse.json({
        success: true,
        data: { message: 'Notifications deleted' }
      })
    }

    if (action === 'clear_all') {
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)

      return NextResponse.json({
        success: true,
        data: { message: 'All notifications cleared' }
      })
    }

    return NextResponse.json(
      { success: false, error: { message: 'Invalid action' } },
      { status: 400 }
    )
  } catch (error) {
    console.error('Notification action error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
