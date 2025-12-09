import { z } from 'zod'
import { UuidSchema, DateTimeSchema } from './common'
import { ClassSchema } from './class'

// Waitlist status - aligned with TOKEN_ENGINE_PLAN.md
export const WaitlistStatusSchema = z.enum([
  'waiting',
  'notified',
  'converted',
  'expired',
  'cancelled'
])
export type WaitlistStatus = z.infer<typeof WaitlistStatusSchema>

// Waitlist entity - matches Supabase 'waitlist' table
export const WaitlistSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  classId: UuidSchema,
  position: z.number().int().positive(),
  joinedAt: DateTimeSchema,
  notifiedAt: DateTimeSchema.nullable(),
  expiresAt: DateTimeSchema.nullable(), // when notification expires
  status: WaitlistStatusSchema.default('waiting'),
  createdAt: DateTimeSchema,
})
export type Waitlist = z.infer<typeof WaitlistSchema>

// Waitlist with class details (for user view)
export const WaitlistWithClassSchema = WaitlistSchema.extend({
  class: ClassSchema.optional(),
})
export type WaitlistWithClass = z.infer<typeof WaitlistWithClassSchema>

// Waitlist with user details (for admin view)
export const WaitlistWithUserSchema = WaitlistSchema.extend({
  userName: z.string(),
  userEmail: z.string().email(),
  class: ClassSchema.optional(),
})
export type WaitlistWithUser = z.infer<typeof WaitlistWithUserSchema>

// Request: Join waitlist
export const JoinWaitlistRequestSchema = z.object({
  classId: UuidSchema,
})
export type JoinWaitlistRequest = z.infer<typeof JoinWaitlistRequestSchema>

// Response: Joined waitlist
export const JoinWaitlistResponseSchema = z.object({
  waitlist: WaitlistWithClassSchema,
  position: z.number().int().positive(),
  estimatedWait: z.string().optional(), // e.g., "2-3 days based on history"
  message: z.string(),
})
export type JoinWaitlistResponse = z.infer<typeof JoinWaitlistResponseSchema>

// Response: Left waitlist
export const LeaveWaitlistResponseSchema = z.object({
  classId: UuidSchema,
  message: z.string(),
})
export type LeaveWaitlistResponse = z.infer<typeof LeaveWaitlistResponseSchema>

// Response: User waitlist entries
export const UserWaitlistResponseSchema = z.object({
  entries: z.array(WaitlistWithClassSchema),
  total: z.number().int().nonnegative(),
})
export type UserWaitlistResponse = z.infer<typeof UserWaitlistResponseSchema>

// Query: Admin waitlist
export const AdminWaitlistQuerySchema = z.object({
  classId: UuidSchema.optional(),
  userId: UuidSchema.optional(),
  status: WaitlistStatusSchema.optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})
export type AdminWaitlistQuery = z.infer<typeof AdminWaitlistQuerySchema>

// Response: Admin waitlist
export const AdminWaitlistResponseSchema = z.object({
  entries: z.array(WaitlistWithUserSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
})
export type AdminWaitlistResponse = z.infer<typeof AdminWaitlistResponseSchema>

// Waitlist notification (when spot opens)
export const WaitlistNotificationSchema = z.object({
  waitlistId: UuidSchema,
  userId: UuidSchema,
  classId: UuidSchema,
  className: z.string(),
  classTime: DateTimeSchema,
  notifiedAt: DateTimeSchema,
  expiresAt: DateTimeSchema,
  confirmUrl: z.string().url(),
  message: z.string(),
})
export type WaitlistNotification = z.infer<typeof WaitlistNotificationSchema>

// Request: Confirm waitlist spot
export const ConfirmWaitlistRequestSchema = z.object({
  waitlistId: UuidSchema,
})
export type ConfirmWaitlistRequest = z.infer<typeof ConfirmWaitlistRequestSchema>

// Response: Waitlist confirmed (converted to booking)
export const ConfirmWaitlistResponseSchema = z.object({
  bookingId: UuidSchema,
  classId: UuidSchema,
  tokensHeld: z.number().int().positive(),
  message: z.string(),
})
export type ConfirmWaitlistResponse = z.infer<typeof ConfirmWaitlistResponseSchema>
