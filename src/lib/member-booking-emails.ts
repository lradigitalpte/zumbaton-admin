/**
 * Send admin + tutor booking emails via the web app Resend API.
 * Email failures are logged only — they never block the booking.
 */

export interface MemberBookingEmailPayload {
  memberName: string
  memberEmail: string
  memberPhone?: string
  className: string
  classDate: string
  classTime: string
  classLocation: string
  instructorName?: string
  tokensUsed: number
  bookingId?: string
  bookingNote?: string
  tutorEmail?: string
}

async function postEmail(type: 'member-booking-admin' | 'member-booking-tutor', data: Record<string, unknown>) {
  const { getWebAppUrl } = await import('@/lib/email-url')
  const webAppUrl = getWebAppUrl()
  const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'

  const response = await fetch(`${webAppUrl}/api/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      secret: emailApiSecret,
      data,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Email API ${type} failed (${response.status}): ${body}`)
  }
}

export async function sendMemberBookingStaffEmailsViaApi(
  adminEmails: string[],
  payload: MemberBookingEmailPayload
): Promise<void> {
  try {
    if (adminEmails.length > 0) {
      await postEmail('member-booking-admin', {
        adminEmails,
        memberName: payload.memberName,
        memberEmail: payload.memberEmail,
        memberPhone: payload.memberPhone,
        className: payload.className,
        classDate: payload.classDate,
        classTime: payload.classTime,
        classLocation: payload.classLocation,
        instructorName: payload.instructorName,
        tokensUsed: payload.tokensUsed,
        bookingId: payload.bookingId,
        bookingNote: payload.bookingNote,
      })
      console.log(`[Booking] Member booking admin email sent to ${adminEmails.length} admins`)
    }

    if (payload.tutorEmail) {
      await postEmail('member-booking-tutor', {
        tutorEmail: payload.tutorEmail,
        memberName: payload.memberName,
        className: payload.className,
        classDate: payload.classDate,
        classTime: payload.classTime,
        classLocation: payload.classLocation,
        tokensUsed: payload.tokensUsed,
        bookingNote: payload.bookingNote,
      })
      console.log(`[Booking] Member booking tutor email sent to ${payload.tutorEmail}`)
    }
  } catch (error) {
    console.error('[Booking] Failed to send member booking staff emails:', error)
  }
}

export function formatBookingDateTime(scheduledAt: string) {
  const classDate = new Date(scheduledAt)
  return {
    formattedDate: classDate.toLocaleDateString('en-SG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Singapore',
    }),
    formattedTime: classDate.toLocaleTimeString('en-SG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Singapore',
    }),
  }
}
