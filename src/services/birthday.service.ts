// Member birthdays in Asia/Singapore, plus the birthday wish email.
// Shared by the Celebrate page, its Send button, and the daily birthday-wishes job.

import { getSupabaseAdminClient } from '@/lib/supabase'
import { sendAdminEmail } from '@/lib/admin-email'
import { singaporeDateString } from '@/lib/week-streak'

/** A wish sent this many days after a birthday still counts for that birthday. */
const BELATED_WINDOW_DAYS = 30

export interface BirthdayMember {
  id: string
  name: string
  email: string
  dateOfBirth: string
  /** YYYY-MM-DD of the next birthday (today counts) in Singapore */
  nextBirthday: string
  /** Current age in years */
  age: number
  /** Age on the next birthday */
  turning: number
  isToday: boolean
  daysUntil: number
  isActive: boolean
  emailOptedOut: boolean
  /** The birthday a wish sent today would count for (recent past birthday, or the next one) */
  celebrationYear: number
  wished: boolean
  wishedAt: string | null
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Birthday in a given year; 29 Feb falls on 28 Feb in non-leap years. */
function birthdayIn(year: number, month: number, day: number): string {
  const safeDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

function daysBetween(from: string, to: string): number {
  const a = parseDate(from)!
  const b = parseDate(to)!
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000)
}

export function singaporeToday(now: Date = new Date()): string {
  return singaporeDateString(now)
}

export async function getBirthdayMembers(now: Date = new Date()): Promise<BirthdayMember[]> {
  const admin = getSupabaseAdminClient()
  const today = singaporeToday(now)
  const todayYear = Number(today.slice(0, 4))

  const { data: users, error } = await admin
    .from('user_profiles')
    .select('id, name, email, date_of_birth, is_active, last_birthday_wish_year, last_birthday_wish_at')
    .not('date_of_birth', 'is', null)

  if (error) throw new Error(`Failed to load birthdays: ${error.message}`)

  const ids = (users || []).map((user) => user.id as string)
  const optedOut = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data: prefs, error: prefError } = await admin
      .from('user_notification_preferences')
      .select('user_id, email_enabled')
      .in('user_id', ids.slice(i, i + 100))
    if (prefError) throw new Error(`Failed to load email preferences: ${prefError.message}`)
    for (const pref of prefs || []) {
      if (pref.email_enabled === false) optedOut.add(pref.user_id)
    }
  }

  const members: BirthdayMember[] = []
  for (const user of users || []) {
    const born = parseDate(String(user.date_of_birth))
    if (!born) continue

    let nextBirthday = birthdayIn(todayYear, born.month, born.day)
    if (nextBirthday < today) nextBirthday = birthdayIn(todayYear + 1, born.month, born.day)
    const nextYear = Number(nextBirthday.slice(0, 4))
    const daysUntil = daysBetween(today, nextBirthday)
    const turning = nextYear - born.year
    const isToday = daysUntil === 0

    const lastBirthday = isToday ? nextBirthday : birthdayIn(nextYear - 1, born.month, born.day)
    const sinceLast = daysBetween(lastBirthday, today)
    const celebrationYear = !isToday && sinceLast <= BELATED_WINDOW_DAYS ? nextYear - 1 : nextYear
    const wishYear = (user.last_birthday_wish_year as number | null) ?? null

    members.push({
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      dateOfBirth: String(user.date_of_birth).slice(0, 10),
      nextBirthday,
      age: isToday ? turning : turning - 1,
      turning,
      isToday,
      daysUntil,
      isActive: user.is_active !== false,
      emailOptedOut: optedOut.has(user.id),
      celebrationYear,
      wished: wishYear !== null && wishYear >= celebrationYear,
      wishedAt: (user.last_birthday_wish_at as string | null) ?? null,
    })
  }

  return members.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))
}

/**
 * Sends the birthday email and records the wish. Claims the row first so two
 * runs (or a run and the Send button) can't both email the same member.
 */
export async function sendBirthdayWish(
  member: Pick<BirthdayMember, 'id' | 'name' | 'email' | 'dateOfBirth' | 'celebrationYear'>,
  options: { force?: boolean } = {},
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const admin = getSupabaseAdminClient()
  const year = member.celebrationYear
  const sentAt = new Date().toISOString()

  const { data: previous } = await admin
    .from('user_profiles')
    .select('last_birthday_wish_year, last_birthday_wish_at')
    .eq('id', member.id)
    .maybeSingle()

  let claim = admin
    .from('user_profiles')
    .update({ last_birthday_wish_year: year, last_birthday_wish_at: sentAt })
    .eq('id', member.id)
  if (!options.force) {
    claim = claim.or(`last_birthday_wish_year.is.null,last_birthday_wish_year.lt.${year}`)
  }
  const { data: claimed, error: claimError } = await claim.select('id')

  if (claimError) return { success: false, error: claimError.message }
  if (!claimed || claimed.length === 0) return { success: false, skipped: true, error: 'Already wished for this birthday' }

  const result = await sendAdminEmail('birthday', {
    userEmail: member.email,
    userName: member.name,
    age: year - Number(member.dateOfBirth.slice(0, 4)),
  })

  if (!result.success) {
    await admin
      .from('user_profiles')
      .update({
        last_birthday_wish_year: previous?.last_birthday_wish_year ?? null,
        last_birthday_wish_at: previous?.last_birthday_wish_at ?? null,
      })
      .eq('id', member.id)
    return { success: false, error: result.error || 'Email failed to send' }
  }

  return { success: true }
}
