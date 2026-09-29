// Cancellation policy (tokens are spent at booking time):
// - Cancel by 23:59 (Singapore time) the day before the class -> token refunded
// - On the day of the class -> members cannot cancel
// - Admins can always cancel with a refund (forceRefund)
// Keep in sync with zumbaton-web/src/lib/cancellation-policy.ts

export const SAME_DAY_CANCEL_MESSAGE =
  'Same-day cancellations are not allowed. Please cancel by 23:59 the day before the class to receive a refund.'

const singaporeDate = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Singapore',
})

/** Calendar date (YYYY-MM-DD) in Singapore time. */
export function toSingaporeDate(value: string | Date): string {
  return singaporeDate.format(new Date(value))
}

/** True when the class is on a later Singapore calendar date than now, i.e. the member may still cancel for a refund. */
export function canCancelWithRefund(classStartsAt: string | Date, now: Date = new Date()): boolean {
  return toSingaporeDate(classStartsAt) > toSingaporeDate(now)
}
