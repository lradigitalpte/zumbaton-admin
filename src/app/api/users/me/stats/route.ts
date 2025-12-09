/**
 * User Stats API Route
 * GET /api/users/me/stats - Get current user's stats for dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { getCurrentUserProfile } from '@/services/user.service'

/**
 * GET /api/users/me/stats - Get current user's stats
 */
async function handleGetStats(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const profile = await getCurrentUserProfile(context.user.id)

    if (!profile.stats) {
      return NextResponse.json({
        success: true,
        data: {
          totalClassesAttended: 0,
          tokensUsed: 0,
          currentStreak: 0,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        totalClassesAttended: profile.stats.totalClassesAttended || 0,
        tokensUsed: profile.stats.totalTokensUsed || 0,
        currentStreak: profile.stats.streakCurrent || 0,
      },
    })
  } catch (error) {
    console.error('Error getting user stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to get user stats',
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withAuthentication(handleGetStats)

