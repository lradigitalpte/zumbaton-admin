/**
 * Notification API Routes
 * GET /api/notifications - Get user's notifications
 * POST /api/notifications - Send notification (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { 
  getUserNotifications, 
  sendNotification
} from '@/services/notification.service'
import { createAuditLog } from '@/services/rbac.service'
import { SendNotificationRequestSchema } from '@/api/schemas/notification'
import { z } from 'zod'

// Query params schema
const NotificationQuerySchema = z.object({
  page: z.preprocess(
    (val) => {
      if (val === null || val === '' || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().int().positive().default(1)
  ),
  limit: z.preprocess(
    (val) => {
      if (val === null || val === '' || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().int().min(1).max(100).default(20)
  ),
  unreadOnly: z.preprocess(
    (val) => val === null || val === '' || val === undefined ? 'false' : val,
    z.enum(['true', 'false']).transform(v => v === 'true')
  ),
  channel: z.preprocess(
    (val) => val === null || val === '' ? undefined : val,
    z.enum(['email', 'push', 'sms', 'in_app']).optional()
  )
})

/**
 * GET /api/notifications - Get current user's notifications
 */
async function handleGetNotifications(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const queryResult = NotificationQuerySchema.safeParse({
      page: url.searchParams.get('page') || undefined,
      limit: url.searchParams.get('limit') || undefined,
      unreadOnly: url.searchParams.get('unreadOnly') || undefined,
      channel: url.searchParams.get('channel') || undefined
    })

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid query parameters', details: queryResult.error.issues },
        { status: 400 }
      )
    }

    const { page, limit, unreadOnly, channel } = queryResult.data

    const result = await getUserNotifications(context.user.id, {
      page,
      pageSize: limit,
      unreadOnly,
      channel
    })

    return NextResponse.json({
      data: result.notifications,
      unreadCount: result.unreadCount,
      pagination: {
        page,
        limit,
        total: result.meta.total,
        totalPages: Math.ceil(result.meta.total / limit)
      }
    })
  } catch (error) {
    console.error('Error getting notifications:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get notifications' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications - Send notification (admin only)
 */
async function handleSendNotification(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const body = await request.json()
    const parseResult = SendNotificationRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const { userId, type, channel, data } = parseResult.data

    const notification = await sendNotification({
      userId,
      type,
      channel,
      data
    })

    // Log the action
    await createAuditLog({
      userId: context.user.id,
      action: 'send_notification',
      resourceType: 'notifications',
      resourceId: notification.notificationId,
      newValues: { recipientId: userId, type, channel }
    })

    return NextResponse.json({ data: notification }, { status: 201 })
  } catch (error) {
    console.error('Error sending notification:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to send notification' },
      { status: 500 }
    )
  }
}

// Export handlers
export const GET = withAuthentication(handleGetNotifications)
export const POST = withAuth(handleSendNotification, { requiredRole: 'admin' })
