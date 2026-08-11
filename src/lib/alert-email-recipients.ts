import type { SupabaseClient } from '@supabase/supabase-js'

export const NOTIFICATION_ALERTS_SETTINGS_KEY = 'notification_alerts'

export interface NotificationAlertsSettings {
  emails: string[]
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function parseEmailList(raw: string): string[] {
  return raw
    .split(/[;,\n]/)
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean)
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email))
}

export function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const email of emails.map(normalizeEmail).filter(Boolean)) {
    if (!seen.has(email)) {
      seen.add(email)
      result.push(email)
    }
  }

  return result
}

export function getDefaultNotificationAlertsSettings(): NotificationAlertsSettings {
  return { emails: [] }
}

export async function getNotificationAlertsSettings(
  supabase: SupabaseClient
): Promise<NotificationAlertsSettings> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', NOTIFICATION_ALERTS_SETTINGS_KEY)
    .maybeSingle()

  if (error || !data?.value) {
    return getDefaultNotificationAlertsSettings()
  }

  const value = data.value as Partial<NotificationAlertsSettings>
  return {
    emails: dedupeEmails(Array.isArray(value.emails) ? value.emails : []),
  }
}

export async function getConfiguredAlertEmails(
  supabase: SupabaseClient
): Promise<string[]> {
  return (await getNotificationAlertsSettings(supabase)).emails
}

/** Alert recipients = only emails saved in Admin > Settings > Notifications. */
export async function getStaffAlertRecipients(
  supabase: SupabaseClient
): Promise<string[]> {
  return getConfiguredAlertEmails(supabase)
}
