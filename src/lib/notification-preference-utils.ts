import type { SupabaseClient } from '@supabase/supabase-js'

type GranularChannel = { email?: boolean; push?: boolean; sms?: boolean }

const DEFAULT_BOOKING_CONFIRMATION: GranularChannel = {
  email: true,
  push: true,
  sms: false,
}

const DEFAULT_BOOKING_CANCELLED: GranularChannel = {
  email: true,
  push: true,
  sms: false,
}

function getGranularChannel(
  granular: Record<string, GranularChannel> | null | undefined,
  key: string,
  defaults: GranularChannel
): GranularChannel {
  return {
    ...defaults,
    ...(granular?.[key] || {}),
  }
}

export function isBookingConfirmationEmailEnabled(
  emailEnabled: boolean | null | undefined,
  granular: Record<string, GranularChannel> | null | undefined
): boolean {
  if (emailEnabled === false) return false
  const channel = getGranularChannel(granular, 'booking_confirmation', DEFAULT_BOOKING_CONFIRMATION)
  return channel.email !== false
}

export function isBookingConfirmationInAppEnabled(
  granular: Record<string, GranularChannel> | null | undefined
): boolean {
  const channel = getGranularChannel(granular, 'booking_confirmation', DEFAULT_BOOKING_CONFIRMATION)
  return channel.push !== false
}

export function isBookingCancelledInAppEnabled(
  granular: Record<string, GranularChannel> | null | undefined
): boolean {
  const channel = getGranularChannel(granular, 'booking_cancelled', DEFAULT_BOOKING_CANCELLED)
  return channel.push !== false
}

export async function filterEmailsForBookingConfirmation(
  supabase: SupabaseClient,
  emails: string[]
): Promise<string[]> {
  const uniqueEmails = [...new Set(emails.filter(Boolean))]
  if (uniqueEmails.length === 0) return []

  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, email')
    .in('email', uniqueEmails)

  if (!users?.length) return uniqueEmails

  const userIds = users.map((user) => user.id)
  const { data: prefsRows } = await supabase
    .from('user_notification_preferences')
    .select('user_id, email_enabled, granular_preferences')
    .in('user_id', userIds)

  const prefsByUserId = new Map(
    (prefsRows || []).map((row) => [row.user_id as string, row])
  )

  return uniqueEmails.filter((email) => {
    const user = users.find((row) => row.email === email)
    if (!user) return true

    const prefs = prefsByUserId.get(user.id)
    if (!prefs) return true

    return isBookingConfirmationEmailEnabled(
      prefs.email_enabled as boolean | null | undefined,
      prefs.granular_preferences as Record<string, GranularChannel> | null | undefined
    )
  })
}

export async function isUserBookingConfirmationEmailEnabled(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  const filtered = await filterEmailsForBookingConfirmation(supabase, [email])
  return filtered.includes(email)
}

export async function getUserInAppPreference(
  supabase: SupabaseClient,
  userId: string,
  preferenceKey: 'booking_confirmation' | 'booking_cancelled'
): Promise<boolean> {
  const { data: prefs } = await supabase
    .from('user_notification_preferences')
    .select('granular_preferences')
    .eq('user_id', userId)
    .maybeSingle()

  const granular = prefs?.granular_preferences as Record<string, GranularChannel> | null | undefined

  if (preferenceKey === 'booking_confirmation') {
    return isBookingConfirmationInAppEnabled(granular)
  }

  return isBookingCancelledInAppEnabled(granular)
}
