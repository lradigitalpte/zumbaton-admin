import { getSupabaseAdminClient } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import type {
  Notification,
  NotificationPreferences,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  SendNotificationRequest,
  SendBulkNotificationRequest,
  UpdateNotificationPreferencesRequest,
  SubscribePushRequest,
  NotificationListQuery,
  NotificationListResponse,
  SendNotificationResponse,
} from '@/api/schemas'

// =====================================================
// HELPER: Convert DB row to Notification
// =====================================================

function toNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    templateId: row.template_id as string | null,
    type: row.type as string,
    channel: row.channel as NotificationChannel,
    subject: row.subject as string | null,
    body: row.body as string,
    data: (row.data as Record<string, unknown>) || {},
    status: row.status as NotificationStatus,
    sentAt: row.sent_at as string | null,
    readAt: row.read_at as string | null,
    errorMessage: row.error_message as string | null,
    createdAt: row.created_at as string,
  }
}

function toNotificationPreferences(row: Record<string, unknown>): NotificationPreferences {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    emailEnabled: row.email_enabled as boolean,
    pushEnabled: row.push_enabled as boolean,
    smsEnabled: row.sms_enabled as boolean,
    bookingReminders: row.booking_reminders as boolean,
    marketingEmails: row.marketing_emails as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// =====================================================
// GET NOTIFICATION TEMPLATE
// =====================================================

async function getTemplate(type: NotificationType): Promise<{
  subject: string | null
  bodyHtml: string
  bodyText: string
  variables: string[]
} | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from('notification_templates')
    .select('*')
    .eq('type', type)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return null
  }

  return {
    subject: data.subject,
    bodyHtml: data.body_html,
    bodyText: data.body_text,
    variables: data.variables || [],
  }
}

// =====================================================
// REPLACE TEMPLATE VARIABLES
// =====================================================

function replaceVariables(text: string, data: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return String(data[key] ?? match)
  })
}

// =====================================================
// SEND NOTIFICATION
// =====================================================

export async function sendNotification(
  request: SendNotificationRequest
): Promise<SendNotificationResponse> {
  const { userId, type, channel, data: templateData } = request

  // Check user preferences
  const prefs = await getNotificationPreferences(userId)
  
  if (channel === 'email' && !prefs.emailEnabled) {
    return {
      notificationId: '',
      status: 'failed',
      sentAt: null,
    }
  }
  
  if (channel === 'push' && !prefs.pushEnabled) {
    return {
      notificationId: '',
      status: 'failed',
      sentAt: null,
    }
  }

  // Get template
  const template = await getTemplate(type)
  
  let subject = request.subject || template?.subject || null
  let body = request.body || template?.bodyText || `Notification: ${type}`

  // Replace variables in template
  if (template && templateData) {
    if (subject) subject = replaceVariables(subject, templateData)
    body = replaceVariables(body, templateData)
  }

  // Create notification record
  const { data: notification, error } = await getSupabaseAdminClient()
    .from('notifications')
    .insert({
      user_id: userId,
      template_id: template ? (await getTemplateId(type)) : null,
      type,
      channel,
      subject,
      body,
      data: templateData,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to create notification', 500, error)
  }

  // Actually send the notification based on channel
  let status: NotificationStatus = 'pending'
  let sentAt: string | null = null
  let errorMessage: string | null = null

  try {
    switch (channel) {
      case 'email':
        await sendEmail(userId, subject || '', body)
        status = 'sent'
        sentAt = new Date().toISOString()
        break
      
      case 'push':
        await sendPushNotification(userId, subject || '', body)
        status = 'sent'
        sentAt = new Date().toISOString()
        break
      
      case 'sms':
        await sendSMS(userId, body)
        status = 'sent'
        sentAt = new Date().toISOString()
        break
      
      case 'in_app':
        // In-app notifications are just stored, no external sending
        status = 'delivered'
        sentAt = new Date().toISOString()
        break
    }
  } catch (err) {
    status = 'failed'
    errorMessage = err instanceof Error ? err.message : 'Unknown error'
  }

  // Update notification status
  await getSupabaseAdminClient()
    .from('notifications')
    .update({
      status,
      sent_at: sentAt,
      error_message: errorMessage,
    })
    .eq('id', notification.id)

  return {
    notificationId: notification.id,
    status,
    sentAt,
  }
}

// =====================================================
// SEND BULK NOTIFICATIONS
// =====================================================

export async function sendBulkNotifications(
  request: SendBulkNotificationRequest
): Promise<{ sent: number; failed: number }> {
  const { userIds, type, channel, data } = request
  
  let sent = 0
  let failed = 0

  // Process in batches of 100
  const batchSize = 100
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    
    const results = await Promise.allSettled(
      batch.map(userId =>
        sendNotification({
          userId,
          type,
          channel,
          data,
        })
      )
    )

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.status !== 'failed') {
        sent++
      } else {
        failed++
      }
    })
  }

  return { sent, failed }
}

// =====================================================
// GET USER NOTIFICATIONS
// =====================================================

export async function getUserNotifications(
  userId: string,
  query: NotificationListQuery
): Promise<NotificationListResponse> {
  const { page, pageSize, channel, status, type, unreadOnly } = query
  const offset = (page - 1) * pageSize

  let dbQuery = getSupabaseAdminClient()
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (channel) {
    dbQuery = dbQuery.eq('channel', channel)
  }
  if (status) {
    dbQuery = dbQuery.eq('status', status)
  }
  if (type) {
    dbQuery = dbQuery.eq('type', type)
  }
  if (unreadOnly) {
    dbQuery = dbQuery.is('read_at', null)
  }

  dbQuery = dbQuery.range(offset, offset + pageSize - 1)

  const { data, error, count } = await dbQuery

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch notifications', 500, error)
  }

  // Get unread count
  const { count: unreadCount } = await getSupabaseAdminClient()
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)

  const total = count || 0

  return {
    notifications: (data || []).map(toNotification),
    unreadCount: unreadCount || 0,
    meta: {
      total,
      page,
      pageSize,
      hasMore: offset + (data?.length || 0) < total,
    },
  }
}

// =====================================================
// MARK NOTIFICATION AS READ
// =====================================================

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to mark notification as read', 500, error)
  }
}

// =====================================================
// MARK ALL NOTIFICATIONS AS READ
// =====================================================

export async function markAllNotificationsRead(
  userId: string,
  beforeDate?: string
): Promise<{ count: number }> {
  let query = getSupabaseAdminClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)

  if (beforeDate) {
    query = query.lte('created_at', beforeDate)
  }

  const { error, count } = await query.select('id')

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to mark notifications as read', 500, error)
  }

  return { count: count || 0 }
}

// =====================================================
// GET NOTIFICATION PREFERENCES
// =====================================================

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await getSupabaseAdminClient()
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    // Return defaults if not found
    return {
      id: '',
      userId,
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
      bookingReminders: true,
      marketingEmails: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  return toNotificationPreferences(data)
}

// =====================================================
// UPDATE NOTIFICATION PREFERENCES
// =====================================================

export async function updateNotificationPreferences(
  userId: string,
  updates: UpdateNotificationPreferencesRequest
): Promise<NotificationPreferences> {
  const updateData: Record<string, unknown> = {}
  if (updates.emailEnabled !== undefined) updateData.email_enabled = updates.emailEnabled
  if (updates.pushEnabled !== undefined) updateData.push_enabled = updates.pushEnabled
  if (updates.smsEnabled !== undefined) updateData.sms_enabled = updates.smsEnabled
  if (updates.bookingReminders !== undefined) updateData.booking_reminders = updates.bookingReminders
  if (updates.marketingEmails !== undefined) updateData.marketing_emails = updates.marketingEmails

  const { data, error } = await getSupabaseAdminClient()
    .from('user_notification_preferences')
    .upsert({
      user_id: userId,
      ...updateData,
    })
    .select()
    .single()

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to update preferences', 500, error)
  }

  return toNotificationPreferences(data)
}

// =====================================================
// PUSH SUBSCRIPTION MANAGEMENT
// =====================================================

export async function subscribeToPush(
  userId: string,
  subscription: SubscribePushRequest
): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.p256dhKey,
      auth_key: subscription.authKey,
      device_type: subscription.deviceType,
      is_active: true,
    })

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to save push subscription', 500, error)
  }
}

export async function unsubscribeFromPush(
  userId: string,
  endpoint: string
): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to unsubscribe from push', 500, error)
  }
}

// =====================================================
// GET UNREAD COUNT
// =====================================================

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await getSupabaseAdminClient()
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)

  if (error) {
    return 0
  }

  return count || 0
}

// =====================================================
// GET SINGLE NOTIFICATION
// =====================================================

export async function getNotification(notificationId: string): Promise<Notification | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .single()

  if (error || !data) {
    return null
  }

  return toNotification(data)
}

// =====================================================
// MARK AS READ (alias for markNotificationRead with different signature)
// =====================================================

export async function markAsRead(notificationId: string): Promise<Notification | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .select()
    .single()

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to mark notification as read', 500, error)
  }

  return toNotification(data)
}

// =====================================================
// DELETE NOTIFICATION
// =====================================================

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from('notifications')
    .delete()
    .eq('id', notificationId)

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to delete notification', 500, error)
  }
}

// =====================================================
// HELPER: Get template ID by type
// =====================================================

async function getTemplateId(type: NotificationType): Promise<string | null> {
  const { data } = await getSupabaseAdminClient()
    .from('notification_templates')
    .select('id')
    .eq('type', type)
    .single()

  return data?.id || null
}

// =====================================================
// EMAIL SENDING (placeholder - integrate with email service)
// =====================================================

async function sendEmail(userId: string, subject: string, body: string): Promise<void> {
  // Get user email
  const { data: user } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (!user?.email) {
    throw new Error('User email not found')
  }

  // TODO: Integrate with email service (Resend, SendGrid, etc.)
  // For now, just log
  console.log(`[EMAIL] To: ${user.email}, Subject: ${subject}`)
  console.log(`[EMAIL] Body: ${body}`)

  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: process.env.EMAIL_FROM,
  //   to: user.email,
  //   subject,
  //   html: body,
  // })
}

// =====================================================
// PUSH NOTIFICATION SENDING (placeholder)
// =====================================================

async function sendPushNotification(userId: string, title: string, body: string): Promise<void> {
  // Get user's push subscriptions
  const { data: subscriptions } = await getSupabaseAdminClient()
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!subscriptions?.length) {
    throw new Error('No active push subscriptions')
  }

  // TODO: Integrate with web-push library
  // For now, just log
  console.log(`[PUSH] To user: ${userId}, Title: ${title}`)
  console.log(`[PUSH] Body: ${body}`)
  console.log(`[PUSH] Subscriptions: ${subscriptions.length}`)

  // Example with web-push:
  // const webpush = require('web-push')
  // webpush.setVapidDetails(
  //   'mailto:admin@zumbathon.com',
  //   process.env.VAPID_PUBLIC_KEY,
  //   process.env.VAPID_PRIVATE_KEY
  // )
  // 
  // for (const sub of subscriptions) {
  //   await webpush.sendNotification({
  //     endpoint: sub.endpoint,
  //     keys: {
  //       p256dh: sub.p256dh_key,
  //       auth: sub.auth_key,
  //     },
  //   }, JSON.stringify({ title, body }))
  // }
}

// =====================================================
// SMS SENDING (placeholder)
// =====================================================

async function sendSMS(userId: string, body: string): Promise<void> {
  // Get user phone
  const { data: user } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('phone')
    .eq('id', userId)
    .single()

  if (!user?.phone) {
    throw new Error('User phone not found')
  }

  // TODO: Integrate with SMS service (Twilio, etc.)
  // For now, just log
  console.log(`[SMS] To: ${user.phone}`)
  console.log(`[SMS] Body: ${body}`)

  // Example with Twilio:
  // const twilio = require('twilio')(
  //   process.env.TWILIO_ACCOUNT_SID,
  //   process.env.TWILIO_AUTH_TOKEN
  // )
  // await twilio.messages.create({
  //   body,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: user.phone,
  // })
}

// =====================================================
// CONVENIENCE FUNCTIONS FOR COMMON NOTIFICATIONS
// =====================================================

export async function sendBookingConfirmation(
  userId: string,
  data: {
    userName: string
    classTitle: string
    classDate: string
    classTime: string
    classLocation: string
  }
): Promise<SendNotificationResponse> {
  return sendNotification({
    userId,
    type: 'booking_confirmation',
    channel: 'email',
    data: {
      user_name: data.userName,
      class_title: data.classTitle,
      class_date: data.classDate,
      class_time: data.classTime,
      class_location: data.classLocation,
    },
  })
}

export async function sendBookingReminder(
  userId: string,
  data: {
    userName: string
    classTitle: string
    classTime: string
    classLocation: string
  }
): Promise<SendNotificationResponse> {
  return sendNotification({
    userId,
    type: 'booking_reminder',
    channel: 'push',
    data: {
      user_name: data.userName,
      class_title: data.classTitle,
      class_time: data.classTime,
      class_location: data.classLocation,
    },
  })
}

export async function sendWaitlistSpotAvailable(
  userId: string,
  data: {
    userName: string
    classTitle: string
    classDate: string
    confirmUrl: string
  }
): Promise<SendNotificationResponse> {
  return sendNotification({
    userId,
    type: 'waitlist_spot_available',
    channel: 'email',
    data: {
      user_name: data.userName,
      class_title: data.classTitle,
      class_date: data.classDate,
      confirm_url: data.confirmUrl,
    },
  })
}

export async function sendPaymentSuccessful(
  userId: string,
  data: {
    userName: string
    packageName: string
    tokenCount: number
    amount: string
  }
): Promise<SendNotificationResponse> {
  return sendNotification({
    userId,
    type: 'payment_successful',
    channel: 'email',
    data: {
      user_name: data.userName,
      package_name: data.packageName,
      token_count: data.tokenCount,
      amount: data.amount,
    },
  })
}

export async function sendWelcomeNotification(
  userId: string,
  userName: string
): Promise<SendNotificationResponse> {
  return sendNotification({
    userId,
    type: 'welcome',
    channel: 'email',
    data: {
      user_name: userName,
    },
  })
}
