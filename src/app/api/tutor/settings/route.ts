import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export const dynamic = 'force-dynamic'

interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  language: string
  timezone: string
  dateFormat: string
  timeFormat: '12h' | '24h'
  calendarStartDay: 0 | 1 | 6
  showWeekNumbers: boolean
  defaultClassDuration: number
  reminderMinutesBefore: number
  autoCheckIn: boolean
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  language: 'en',
  timezone: 'America/Los_Angeles',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  calendarStartDay: 0,
  showWeekNumbers: false,
  defaultClassDuration: 60,
  reminderMinutesBefore: 30,
  autoCheckIn: false,
}

/**
 * GET /api/tutor/settings
 * Get user settings
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

    // Try to get existing settings
    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle()

    const settings: UserSettings = existingSettings?.settings 
      ? { ...DEFAULT_SETTINGS, ...existingSettings.settings }
      : DEFAULT_SETTINGS

    return NextResponse.json({
      success: true,
      data: {
        settings,
        options: {
          themes: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ],
          languages: [
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Spanish' },
            { value: 'fr', label: 'French' },
            { value: 'de', label: 'German' },
            { value: 'pt', label: 'Portuguese' },
          ],
          timezones: [
            { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
            { value: 'America/Denver', label: 'Mountain Time (MT)' },
            { value: 'America/Chicago', label: 'Central Time (CT)' },
            { value: 'America/New_York', label: 'Eastern Time (ET)' },
            { value: 'Europe/London', label: 'GMT (London)' },
            { value: 'Europe/Paris', label: 'CET (Paris)' },
            { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
            { value: 'Australia/Sydney', label: 'AEST (Sydney)' },
          ],
          dateFormats: [
            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
          ],
          timeFormats: [
            { value: '12h', label: '12-hour (1:30 PM)' },
            { value: '24h', label: '24-hour (13:30)' },
          ],
          calendarStartDays: [
            { value: 0, label: 'Sunday' },
            { value: 1, label: 'Monday' },
            { value: 6, label: 'Saturday' },
          ],
        }
      }
    })
  } catch (error) {
    console.error('Settings fetch error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/tutor/settings
 * Update user settings
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
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: { message: 'Settings object required' } },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()

    // Upsert settings
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        settings: { ...DEFAULT_SETTINGS, ...settings },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })

    if (error) {
      console.error('Error updating settings:', error)
      
      // If table doesn't exist, settings will use defaults
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          data: { message: 'Settings saved (using defaults)', usingDefaults: true }
        })
      }
      
      return NextResponse.json(
        { success: false, error: { message: 'Failed to update settings' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Settings updated successfully' }
    })
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
