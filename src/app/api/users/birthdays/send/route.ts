/**
 * Send Birthday Email API Route
 * POST /api/users/birthdays/send - Send a birthday wish to one member and record it,
 * so the daily birthday-wishes job won't send it again.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/middleware/rbac'
import { getBirthdayMembers, sendBirthdayWish } from '@/services/birthday.service'
import { z } from 'zod'

const SendBirthdayEmailSchema = z.object({
  userId: z.string().uuid(),
  resend: z.boolean().optional(),
})

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

async function handleSendBirthdayEmail(request: NextRequest): Promise<NextResponse> {
  try {
    const parseResult = SendBirthdayEmailSchema.safeParse(await request.json().catch(() => null))
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid request body', 400)
    }

    const { userId, resend } = parseResult.data
    const member = (await getBirthdayMembers()).find((item) => item.id === userId)

    if (!member) return errorResponse('NO_BIRTHDAY', 'Member not found or has no birthday saved', 404)
    if (!member.email) return errorResponse('NO_EMAIL', 'Member has no email address', 400)
    if (member.wished && !resend) {
      return errorResponse('ALREADY_WISHED', `${member.name || 'This member'} was already wished for this birthday`, 409)
    }

    const result = await sendBirthdayWish(member, { force: resend })
    if (!result.success) {
      return errorResponse(result.skipped ? 'ALREADY_WISHED' : 'EMAIL_ERROR', result.error || 'Failed to send email', result.skipped ? 409 : 502)
    }

    return NextResponse.json({
      success: true,
      message: 'Birthday email sent successfully',
      userEmail: member.email,
      wishedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[API /users/birthdays/send]', error)
    return errorResponse('SERVER_ERROR', error instanceof Error ? error.message : 'An unexpected error occurred', 500)
  }
}

export const POST = withAuth(handleSendBirthdayEmail, { requiredRole: 'admin' })
