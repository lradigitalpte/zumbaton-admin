/**
 * User Birthdays API Route
 * GET /api/users/birthdays - Get users with birthdays (filtered by date range)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getSupabaseAdminClient } from '@/lib/supabase'

/**
 * GET /api/users/birthdays - Get users with birthdays
 * Query params:
 *   - startDate: Start date for birthday range (ISO string, optional)
 *   - endDate: End date for birthday range (ISO string, optional)
 *   - today: If true, only return birthdays today (boolean, optional)
 */
async function handleGetBirthdays(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const today = url.searchParams.get('today') === 'true'
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    const adminClient = getSupabaseAdminClient()

    let query = adminClient
      .from('user_profiles')
      .select('id, name, email, date_of_birth')
      .not('date_of_birth', 'is', null)

    if (today) {
      // Get today's date
      const todayDate = new Date()
      const month = todayDate.getMonth() + 1 // JavaScript months are 0-indexed
      const day = todayDate.getDate()

      // Extract month and day from date_of_birth and match with today
      query = query
        .filter('date_of_birth', 'not.is', null)
        // We'll filter in the application layer since PostgreSQL date extraction can be complex
    }

    const { data: users, error } = await query

    if (error) {
      console.error('[API /users/birthdays] Database error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to fetch birthdays',
          },
        },
        { status: 500 }
      )
    }

    // Filter users based on birthday criteria
    let filteredUsers = (users || []).filter((user: any) => {
      if (!user.date_of_birth) return false

      const birthDate = new Date(user.date_of_birth)
      const birthMonth = birthDate.getMonth() + 1
      const birthDay = birthDate.getDate()

      if (today) {
        const todayDate = new Date()
        const todayMonth = todayDate.getMonth() + 1
        const todayDay = todayDate.getDate()
        return birthMonth === todayMonth && birthDay === todayDay
      }

      if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const currentYear = new Date().getFullYear()

        // Create dates for this year's birthday
        const thisYearBirthday = new Date(currentYear, birthMonth - 1, birthDay)
        const nextYearBirthday = new Date(currentYear + 1, birthMonth - 1, birthDay)

        // Check if birthday falls within range (this year or next year)
        return (
          (thisYearBirthday >= start && thisYearBirthday <= end) ||
          (nextYearBirthday >= start && nextYearBirthday <= end)
        )
      }

      // If no filters, return all users with birthdays
      return true
    })

    // Sort by upcoming birthdays (closest first)
    const todayDate = new Date()
    const currentYear = todayDate.getFullYear()
    filteredUsers.sort((a: any, b: any) => {
      const dateA = new Date(a.date_of_birth)
      const dateB = new Date(b.date_of_birth)
      const birthdayA = new Date(currentYear, dateA.getMonth(), dateA.getDate())
      const birthdayB = new Date(currentYear, dateB.getMonth(), dateB.getDate())

      // If birthday has passed this year, use next year's date
      if (birthdayA < todayDate) {
        birthdayA.setFullYear(currentYear + 1)
      }
      if (birthdayB < todayDate) {
        birthdayB.setFullYear(currentYear + 1)
      }

      return birthdayA.getTime() - birthdayB.getTime()
    })

    // Add computed fields
    const birthdaysWithInfo = filteredUsers.map((user: any) => {
      const birthDate = new Date(user.date_of_birth)
      const todayDate = new Date()
      const currentYear = todayDate.getFullYear()

      // Calculate next birthday
      let nextBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate())
      if (nextBirthday < todayDate) {
        nextBirthday.setFullYear(currentYear + 1)
      }

      // Calculate age (same logic as send route)
      const age = currentYear - birthDate.getFullYear()
      const monthDiff = todayDate.getMonth() - birthDate.getMonth()
      const dayDiff = todayDate.getDate() - birthDate.getDate()
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age

      // Check if birthday is today
      const isToday =
        birthDate.getMonth() === todayDate.getMonth() &&
        birthDate.getDate() === todayDate.getDate()

      // Calculate days until birthday
      const daysUntil = Math.ceil(
        (nextBirthday.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        dateOfBirth: user.date_of_birth,
        nextBirthday: nextBirthday.toISOString(),
        age: actualAge,
        isToday,
        daysUntil,
      }
    })

    return NextResponse.json({
      success: true,
      data: birthdaysWithInfo,
      count: birthdaysWithInfo.length,
    })
  } catch (error) {
    console.error('[API /users/birthdays]', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetBirthdays, { requiredRole: 'admin' })
