/**
 * Individual Notification API Routes
 * GET /api/notifications/[notificationId] - Get notification details
 * PATCH /api/notifications/[notificationId] - Mark as read
 * DELETE /api/notifications/[notificationId] - Delete notification
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { 
  getNotification,
  markAsRead,
  deleteNotification
} from '@/services/notification.service'

type RouteParams = { notificationId: string }

/**
 * GET /api/notifications/[notificationId] - Get notification details
 */
async function handleGetNotification(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const params = await context.params
    const { notificationId } = params

    const notification = await getNotification(notificationId)

    if (!notification) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Notification not found' },
        { status: 404 }
      )
    }

    // Check ownership
    if (notification.userId !== context.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Cannot access this notification' },
        { status: 403 }
      )
    }

    return NextResponse.json({ data: notification })
  } catch (error) {
    console.error('Error getting notification:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get notification' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/notifications/[notificationId] - Mark notification as read
 */
async function handleMarkAsRead(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const params = await context.params
    const { notificationId } = params

    // Verify ownership first
    const notification = await getNotification(notificationId)
    if (!notification) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Notification not found' },
        { status: 404 }
      )
    }

    if (notification.userId !== context.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Cannot modify this notification' },
        { status: 403 }
      )
    }

    const updatedNotification = await markAsRead(notificationId)

    return NextResponse.json({ data: updatedNotification })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update notification' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/[notificationId] - Delete notification
 */
async function handleDeleteNotification(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const params = await context.params
    const { notificationId } = params

    // Verify ownership first
    const notification = await getNotification(notificationId)
    if (!notification) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Notification not found' },
        { status: 404 }
      )
    }

    if (notification.userId !== context.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Cannot delete this notification' },
        { status: 403 }
      )
    }

    await deleteNotification(notificationId)

    return NextResponse.json({ 
      success: true,
      message: 'Notification deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}

// Export handlers
export const GET = withAuthentication(handleGetNotification)
export const PATCH = withAuthentication(handleMarkAsRead)
export const DELETE = withAuthentication(handleDeleteNotification)
