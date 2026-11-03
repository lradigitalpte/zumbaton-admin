/**
 * User Birthdays API Route
 * GET /api/users/birthdays - Members with a date of birth, soonest birthday first (Singapore dates)
 * Query params:
 *   - today: If true, only return birthdays today
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/middleware/rbac'
import { getBirthdayMembers, singaporeToday } from '@/services/birthday.service'

async function handleGetBirthdays(request: NextRequest): Promise<NextResponse> {
  try {
    const todayOnly = new URL(request.url).searchParams.get('today') === 'true'
    const members = await getBirthdayMembers()
    const data = todayOnly ? members.filter((member) => member.isToday) : members

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      today: singaporeToday(),
    })
  } catch (error) {
    console.error('[API /users/birthdays]', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch birthdays',
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetBirthdays, { requiredRole: 'admin' })
