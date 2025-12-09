import { z } from 'zod'
import { UuidSchema, DateTimeSchema, BaseTimestampsSchema } from './common'
import { ClassSchema } from './class'

// Booking status - aligned with TOKEN_ENGINE_PLAN.md
export const BookingStatusSchema = z.enum([
  'confirmed',
  'waitlist',
  'cancelled',
  'cancelled-late',
  'attended',
  'no-show'
])
export type BookingStatus = z.infer<typeof BookingStatusSchema>

// Booking entity - matches Supabase 'bookings' table
export const BookingSchema = BaseTimestampsSchema.extend({
  id: UuidSchema,
  userId: UuidSchema,
  classId: UuidSchema,
  userPackageId: UuidSchema.nullable(),
  tokensUsed: z.number().int().positive().default(1),
  status: BookingStatusSchema.default('confirmed'),
  bookedAt: DateTimeSchema,
  cancelledAt: DateTimeSchema.nullable(),
  cancellationReason: z.string().max(500).nullable(),
})
export type Booking = z.infer<typeof BookingSchema>

// Booking with class details (for user view)
export const BookingWithClassSchema = BookingSchema.extend({
  class: ClassSchema.optional(),
})
export type BookingWithClass = z.infer<typeof BookingWithClassSchema>

// Booking with user details (for admin view)
export const BookingWithUserSchema = BookingSchema.extend({
  userName: z.string(),
  userEmail: z.string().email(),
  class: ClassSchema.optional(),
})
export type BookingWithUser = z.infer<typeof BookingWithUserSchema>

// Request: Create booking
export const CreateBookingRequestSchema = z.object({
  classId: UuidSchema,
})
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>

// Response: Booking created
export const BookingResponseSchema = z.object({
  booking: BookingWithClassSchema,
  tokensHeld: z.number().int().nonnegative(),
  tokensAvailable: z.number().int().nonnegative(),
  message: z.string(),
})
export type BookingResponse = z.infer<typeof BookingResponseSchema>

// Request: Cancel booking
export const CancelBookingRequestSchema = z.object({
  reason: z.string().max(500).optional(),
})
export type CancelBookingRequest = z.infer<typeof CancelBookingRequestSchema>

// Response: Booking cancelled
export const CancelBookingResponseSchema = z.object({
  booking: BookingSchema,
  tokensRefunded: z.number().int().nonnegative(),
  penalty: z.boolean(),
  penaltyReason: z.string().optional(), // e.g., "Late cancellation"
  message: z.string(),
})
export type CancelBookingResponse = z.infer<typeof CancelBookingResponseSchema>

// Response: User bookings list
export const UserBookingsResponseSchema = z.object({
  bookings: z.array(BookingWithClassSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
})
export type UserBookingsResponse = z.infer<typeof UserBookingsResponseSchema>

// Query: User bookings
export const UserBookingsQuerySchema = z.object({
  status: BookingStatusSchema.optional(),
  upcoming: z.boolean().optional(), // filter to future classes only
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})
export type UserBookingsQuery = z.infer<typeof UserBookingsQuerySchema>

// Response: Admin bookings list
export const AdminBookingsResponseSchema = z.object({
  bookings: z.array(BookingWithUserSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
})
export type AdminBookingsResponse = z.infer<typeof AdminBookingsResponseSchema>

// Query: Admin bookings (more filters)
export const AdminBookingsQuerySchema = z.object({
  userId: UuidSchema.optional(),
  classId: UuidSchema.optional(),
  status: BookingStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})
export type AdminBookingsQuery = z.infer<typeof AdminBookingsQuerySchema>
