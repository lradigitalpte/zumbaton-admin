/**
 * Notification alert recipients API
 * GET /api/settings/notification-alerts
 * PUT /api/settings/notification-alerts
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser, hasRequiredRole } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'
import {
  NOTIFICATION_ALERTS_SETTINGS_KEY,
  dedupeEmails,
  getDefaultNotificationAlertsSettings,
  isValidEmail,
  type NotificationAlertsSettings,
} from '@/lib/alert-email-recipients'

async function handleGet(
  _request: NextRequest,
  _context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  const adminClient = getSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('system_settings')
    .select('value, updated_at')
    .eq('key', NOTIFICATION_ALERTS_SETTINGS_KEY)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('[notification-alerts GET]', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to load alert email settings' } },
      { status: 500 }
    )
  }

  const settings: NotificationAlertsSettings = data?.value
    ? {
        emails: dedupeEmails(
          Array.isArray((data.value as NotificationAlertsSettings).emails)
            ? (data.value as NotificationAlertsSettings).emails
            : []
        ),
      }
    : getDefaultNotificationAlertsSettings()

  return NextResponse.json({
    success: true,
    data: {
      ...settings,
      updatedAt: data?.updated_at || null,
    },
  })
}

async function handlePut(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  const isAdmin = hasRequiredRole(context.user.role, 'admin')
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: { message: 'Forbidden' } },
      { status: 403 }
    )
  }

  const body = await request.json()
  const rawEmails = Array.isArray(body.emails) ? body.emails : []
  const emails = dedupeEmails(rawEmails.map((email: unknown) => String(email || '')))

  const invalidEmails = emails.filter((email) => !isValidEmail(email))
  if (invalidEmails.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: `Invalid email address${invalidEmails.length > 1 ? 'es' : ''}: ${invalidEmails.join(', ')}`,
        },
      },
      { status: 400 }
    )
  }

  const adminClient = getSupabaseAdminClient()
  const settings: NotificationAlertsSettings = { emails }

  const { data, error } = await adminClient
    .from('system_settings')
    .upsert(
      {
        key: NOTIFICATION_ALERTS_SETTINGS_KEY,
        value: settings,
        description: 'Extra staff emails for payment and booking alert notifications',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
    .select('value, updated_at')
    .single()

  if (error) {
    console.error('[notification-alerts PUT]', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to save alert email settings' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      ...(data.value as NotificationAlertsSettings),
      updatedAt: data.updated_at,
    },
  })
}

export const GET = withAuthentication(handleGet)
export const PUT = withAuthentication(handlePut)
