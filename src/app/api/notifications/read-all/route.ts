import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { markAllNotificationsRead } from '@/services/notification.service'

/**
 * POST /api/notifications/read-all - Mark all notifications as read
 */
async function handleMarkAllRead(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}))
    const { beforeDate } = body

    const result = await markAllNotificationsRead(context.user.id, beforeDate)

    return NextResponse.json({
      success: true,
      message: 'All notifications marked as read',
      data: { count: result.count },
    })
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to mark all notifications as read' } },
      { status: 500 }
    )
  }
}

export const POST = withAuthentication(handleMarkAllRead)

