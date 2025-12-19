// Notification Preferences API Route
// GET and PUT operations for user notification preferences

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export const dynamic = 'force-dynamic'

// Default granular preferences structure
const DEFAULT_GRANULAR_PREFERENCES = {
  // Booking notifications
  booking_confirmation: { email: true, push: true, sms: false },   // When you/someone books a class
  booking_cancelled: { email: true, push: true, sms: false },      // When you/someone cancels a booking
  booking_reminder: { email: true, push: true, sms: false },       // Class reminder 2 hours before
  waitlist_promotion: { email: true, push: true, sms: false },     // When promoted from waitlist
  no_show_warning: { email: true, push: false, sms: false },       // After a no-show
  class_cancelled: { email: true, push: true, sms: false },        // When admin cancels a class
  
  // Token notifications
  token_purchase: { email: true, push: false, sms: false },        // When tokens are purchased
  token_balance_low: { email: true, push: false, sms: false },     // When token balance is low
  package_expiring: { email: true, push: true, sms: false },       // When package is about to expire
  
  // System notifications
  welcome: { email: true, push: false, sms: false },               // Welcome notification on signup
  payment_successful: { email: true, push: false, sms: false },    // After successful payment
  general: { email: true, push: false, sms: false },               // General announcements
}

// GET /api/notifications/preferences - Get current user's notification preferences
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const supabase = getSupabaseAdminClient()

    // Get notification preferences
    const { data: prefs, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[API /notifications/preferences] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to fetch preferences',
        },
      }, { status: 500 })
    }

    // Merge defaults with user preferences
    const granularPrefs = prefs?.granular_preferences 
      ? { ...DEFAULT_GRANULAR_PREFERENCES, ...prefs.granular_preferences }
      : DEFAULT_GRANULAR_PREFERENCES

    return NextResponse.json({
      success: true,
      data: {
        emailEnabled: prefs?.email_enabled ?? true,
        pushEnabled: prefs?.push_enabled ?? true,
        smsEnabled: prefs?.sms_enabled ?? false,
        bookingReminders: prefs?.booking_reminders ?? true,
        marketingEmails: prefs?.marketing_emails ?? false,
        granular: granularPrefs,
      },
    })
  } catch (error) {
    console.error('[API /notifications/preferences]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

// PUT /api/notifications/preferences - Update notification preferences
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      emailEnabled, 
      pushEnabled, 
      smsEnabled, 
      bookingReminders, 
      marketingEmails,
      granular 
    } = body

    const supabase = getSupabaseAdminClient()

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (emailEnabled !== undefined) updateData.email_enabled = emailEnabled
    if (pushEnabled !== undefined) updateData.push_enabled = pushEnabled
    if (smsEnabled !== undefined) updateData.sms_enabled = smsEnabled
    if (bookingReminders !== undefined) updateData.booking_reminders = bookingReminders
    if (marketingEmails !== undefined) updateData.marketing_emails = marketingEmails
    if (granular !== undefined) {
      // Merge with defaults to ensure all notification types exist
      updateData.granular_preferences = { ...DEFAULT_GRANULAR_PREFERENCES, ...granular }
    }

    // Upsert preferences
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .upsert({
        user_id: user.id,
        ...updateData,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (error) {
      console.error('[API /notifications/preferences PUT] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to update preferences',
        },
      }, { status: 500 })
    }

    // Return updated preferences
    const granularPrefs = data.granular_preferences 
      ? { ...DEFAULT_GRANULAR_PREFERENCES, ...data.granular_preferences }
      : DEFAULT_GRANULAR_PREFERENCES

    return NextResponse.json({
      success: true,
      data: {
        emailEnabled: data.email_enabled,
        pushEnabled: data.push_enabled,
        smsEnabled: data.sms_enabled,
        bookingReminders: data.booking_reminders,
        marketingEmails: data.marketing_emails,
        granular: granularPrefs,
      },
    })
  } catch (error) {
    console.error('[API /notifications/preferences PUT]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

