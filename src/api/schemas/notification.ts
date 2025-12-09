import { z } from 'zod'

// =====================================================
// NOTIFICATION CHANNEL & STATUS
// =====================================================

export const NotificationChannelSchema = z.enum(['email', 'push', 'sms', 'in_app'])
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>

export const NotificationStatusSchema = z.enum(['pending', 'sent', 'delivered', 'failed', 'read'])
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export const NotificationTypeSchema = z.enum([
  'booking_confirmation',
  'booking_reminder',
  'booking_cancelled',
  'waitlist_spot_available',
  'token_balance_low',
  'package_expiring',
  'payment_successful',
  'payment_failed',
  'welcome',
  'password_reset',
  'no_show_warning',
  'class_cancelled',
  'general',
])
export type NotificationType = z.infer<typeof NotificationTypeSchema>

// =====================================================
// NOTIFICATION TEMPLATE SCHEMAS
// =====================================================

export const NotificationTemplateSchema = z.object({
  id: z.string().uuid(),
  type: NotificationTypeSchema,
  name: z.string(),
  subject: z.string().nullable(),
  bodyHtml: z.string(),
  bodyText: z.string(),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type NotificationTemplate = z.infer<typeof NotificationTemplateSchema>

// =====================================================
// NOTIFICATION SCHEMAS
// =====================================================

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  templateId: z.string().uuid().nullable(),
  type: z.string(),
  channel: NotificationChannelSchema,
  subject: z.string().nullable(),
  body: z.string(),
  data: z.record(z.unknown()).default({}),
  status: NotificationStatusSchema,
  sentAt: z.string().datetime().nullable(),
  readAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export type Notification = z.infer<typeof NotificationSchema>

// =====================================================
// NOTIFICATION PREFERENCES SCHEMAS
// =====================================================

export const NotificationPreferencesSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  bookingReminders: z.boolean(),
  marketingEmails: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>

// =====================================================
// PUSH SUBSCRIPTION SCHEMAS
// =====================================================

export const PushSubscriptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  endpoint: z.string().url(),
  p256dhKey: z.string(),
  authKey: z.string(),
  deviceType: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
})

export type PushSubscription = z.infer<typeof PushSubscriptionSchema>

// =====================================================
// REQUEST SCHEMAS
// =====================================================

export const SendNotificationRequestSchema = z.object({
  userId: z.string().uuid(),
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema.default('in_app'),
  data: z.record(z.unknown()).default({}), // Template variables
  subject: z.string().optional(), // Override template subject
  body: z.string().optional(), // Override template body
})

export type SendNotificationRequest = z.infer<typeof SendNotificationRequestSchema>

export const SendBulkNotificationRequestSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(1000),
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema.default('in_app'),
  data: z.record(z.unknown()).default({}),
})

export type SendBulkNotificationRequest = z.infer<typeof SendBulkNotificationRequestSchema>

export const UpdateNotificationPreferencesRequestSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  bookingReminders: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
})

export type UpdateNotificationPreferencesRequest = z.infer<typeof UpdateNotificationPreferencesRequestSchema>

export const SubscribePushRequestSchema = z.object({
  endpoint: z.string().url(),
  p256dhKey: z.string(),
  authKey: z.string(),
  deviceType: z.string().optional(),
})

export type SubscribePushRequest = z.infer<typeof SubscribePushRequestSchema>

export const MarkNotificationReadRequestSchema = z.object({
  notificationId: z.string().uuid(),
})

export type MarkNotificationReadRequest = z.infer<typeof MarkNotificationReadRequestSchema>

export const MarkAllNotificationsReadRequestSchema = z.object({
  beforeDate: z.string().datetime().optional(), // Mark all before this date
})

export type MarkAllNotificationsReadRequest = z.infer<typeof MarkAllNotificationsReadRequestSchema>

// =====================================================
// QUERY SCHEMAS
// =====================================================

export const NotificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  channel: NotificationChannelSchema.optional(),
  status: NotificationStatusSchema.optional(),
  type: z.string().optional(),
  unreadOnly: z.coerce.boolean().default(false),
})

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>

// =====================================================
// RESPONSE SCHEMAS
// =====================================================

export const NotificationListResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
  unreadCount: z.number().int().nonnegative(),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasMore: z.boolean(),
  }),
})

export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>

export const SendNotificationResponseSchema = z.object({
  notificationId: z.string().uuid(),
  status: NotificationStatusSchema,
  sentAt: z.string().datetime().nullable(),
})

export type SendNotificationResponse = z.infer<typeof SendNotificationResponseSchema>

export const UnreadCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
})

export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>
