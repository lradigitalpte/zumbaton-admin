/**
 * Week streak math in Asia/Singapore.
 * A week starts Monday 00:00 and ends Sunday 23:59.
 * Keep the date helpers in sync with zumbaton-web/src/lib/week-streak.ts.
 */

const SG_TIMEZONE = 'Asia/Singapore'

const singaporeDate = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: SG_TIMEZONE,
})

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function utcDateFromParts(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

/** Calendar date (YYYY-MM-DD) in Singapore. */
export function singaporeDateString(value: Date): string {
  return singaporeDate.format(value)
}

/** Monday (YYYY-MM-DD) of the Singapore week that contains `value`. */
export function singaporeWeekStart(value: Date): string {
  const [year, month, day] = singaporeDateString(value).split('-').map(Number)
  const utc = utcDateFromParts(year, month, day)
  const weekday = utc.getUTCDay()
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1
  utc.setUTCDate(utc.getUTCDate() - daysFromMonday)
  return formatUtcDate(utc)
}

/** Shift a YYYY-MM-DD date by a number of calendar days. */
export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const utc = utcDateFromParts(year, month, day)
  utc.setUTCDate(utc.getUTCDate() + days)
  return formatUtcDate(utc)
}

/** Inclusive start and exclusive end of the Singapore week, as +08:00 timestamps. */
export function singaporeWeekBounds(now: Date = new Date()): {
  weekStart: string
  startIso: string
  endIso: string
} {
  const weekStart = singaporeWeekStart(now)
  const weekEnd = addDaysToDateString(weekStart, 7)
  return {
    weekStart,
    startIso: `${weekStart}T00:00:00+08:00`,
    endIso: `${weekEnd}T00:00:00+08:00`,
  }
}

function weeksAreConsecutive(earlier: string, later: string): boolean {
  return addDaysToDateString(earlier, 7) === later
}

/**
 * Current streak stays alive through the week after the last attended week,
 * so a member who came last week still has a streak until this week ends.
 * A gap of a full week resets current to 0 until the next attended class.
 */
export function computeWeekStreak(
  classInstants: Array<string | Date>,
  now: Date = new Date(),
): { current: number; longest: number } {
  const weeks = [...new Set(classInstants.map((value) => singaporeWeekStart(new Date(value))))].sort()
  if (weeks.length === 0) {
    return { current: 0, longest: 0 }
  }

  let longest = 1
  let run = 1
  for (let i = 1; i < weeks.length; i++) {
    run = weeksAreConsecutive(weeks[i - 1], weeks[i]) ? run + 1 : 1
    if (run > longest) longest = run
  }

  const currentWeek = singaporeWeekStart(now)
  const lastWeek = weeks[weeks.length - 1]
  const previousWeek = addDaysToDateString(currentWeek, -7)
  if (lastWeek !== currentWeek && lastWeek !== previousWeek) {
    return { current: 0, longest }
  }

  let current = 1
  for (let i = weeks.length - 1; i > 0; i--) {
    if (!weeksAreConsecutive(weeks[i - 1], weeks[i])) break
    current += 1
  }

  return { current, longest }
}
