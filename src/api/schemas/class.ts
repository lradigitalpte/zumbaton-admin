import { z } from 'zod'
import { UuidSchema, DateTimeSchema, BaseTimestampsSchema, ClassLevelSchema } from './common'
import { ClassTypeSchema } from './package'

// Class status - aligned with TOKEN_ENGINE_PLAN.md
export const ClassStatusSchema = z.enum([
  'scheduled',
  'in-progress',
  'completed',
  'cancelled'
])
export type ClassStatus = z.infer<typeof ClassStatusSchema>

// Class entity - matches Supabase 'classes' table
export const ClassSchema = BaseTimestampsSchema.extend({
  id: UuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  classType: ClassTypeSchema,
  level: ClassLevelSchema.default('all_levels'),
  instructorId: UuidSchema.nullable(),
  instructorName: z.string().nullable(),
  scheduledAt: DateTimeSchema,
  durationMinutes: z.number().int().positive().default(60),
  capacity: z.number().int().positive(),
  tokenCost: z.number().int().positive().default(1),
  location: z.string().max(200).nullable(),
  status: ClassStatusSchema.default('scheduled'),
  recurrenceType: z.enum(['single', 'recurring', 'course']).optional(),
  recurrencePattern: z.record(z.unknown()).nullable().optional(),
  roomId: UuidSchema.nullable().optional(),
  categoryId: UuidSchema.nullable().optional(),
})
export type Class = z.infer<typeof ClassSchema>

// Extended class with availability info (computed fields)
export const ClassWithAvailabilitySchema = ClassSchema.extend({
  bookedCount: z.number().int().nonnegative(),
  spotsRemaining: z.number().int(),
  waitlistCount: z.number().int().nonnegative(),
  isBookable: z.boolean(),
})
export type ClassWithAvailability = z.infer<typeof ClassWithAvailabilitySchema>

// Request: Create class (admin only)
export const CreateClassRequestSchema = z.object({
  title: z.string().min(1, 'Class title is required').max(200),
  description: z.string().max(1000).optional(),
  classType: ClassTypeSchema,
  level: ClassLevelSchema.default('all_levels'),
  instructorId: UuidSchema.optional(),
  instructorIds: z.array(UuidSchema).optional(), // Multiple instructor IDs
  scheduledAt: z.string().datetime('Invalid datetime format'),
  durationMinutes: z.number().int().positive().default(60),
  capacity: z.number().int().positive('Capacity must be at least 1'),
  tokenCost: z.number().int().positive().default(1),
  location: z.string().max(200).optional(),
  roomId: UuidSchema.optional(),
  categoryId: UuidSchema.optional(),
  recurrenceType: z.enum(['single', 'recurring', 'course']).optional(),
  recurrencePattern: z.object({
    days: z.array(z.string()).optional(),
    endDate: z.string().optional(),
    endType: z.enum(['never', 'date', 'count']).optional(),
    occurrences: z.number().int().positive().optional(),
  }).optional(),
})
export type CreateClassRequest = z.infer<typeof CreateClassRequestSchema>

// Request: Update class (admin only)
export const UpdateClassRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  classType: ClassTypeSchema.optional(),
  level: ClassLevelSchema.optional(),
  instructorId: UuidSchema.nullable().optional(),
  instructorIds: z.array(UuidSchema).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  capacity: z.number().int().positive().optional(),
  tokenCost: z.number().int().positive().optional(),
  dropInTokenCost: z.number().int().positive().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  status: ClassStatusSchema.optional(),
  roomId: UuidSchema.nullable().optional(),
  categoryId: UuidSchema.nullable().optional(),
  recurrenceType: z.enum(['single', 'recurring', 'course']).optional(),
  recurrencePattern: z.record(z.any()).nullable().optional(),
})
export type UpdateClassRequest = z.infer<typeof UpdateClassRequestSchema>

// Response: Single class with availability
export const ClassResponseSchema = z.object({
  class: ClassWithAvailabilitySchema,
})
export type ClassResponse = z.infer<typeof ClassResponseSchema>

// Response: Class list with pagination
export const ClassListResponseSchema = z.object({
  classes: z.array(ClassWithAvailabilitySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
  stats: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    full: z.number().int().nonnegative(),
  }).optional(),
})
export type ClassListResponse = z.infer<typeof ClassListResponseSchema>

// Query: List classes
export const ClassListQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  classType: ClassTypeSchema.optional(),
  level: ClassLevelSchema.optional(),
  instructorId: UuidSchema.optional(),
  status: ClassStatusSchema.optional(),
})
export type ClassListQuery = z.infer<typeof ClassListQuerySchema>

// Class attendee info (for admin view)
export const ClassAttendeeSchema = z.object({
  bookingId: UuidSchema,
  userId: UuidSchema,
  userName: z.string(),
  userEmail: z.string().email(),
  status: z.string(),
  bookedAt: DateTimeSchema,
  checkedInAt: DateTimeSchema.nullable(),
})
export type ClassAttendee = z.infer<typeof ClassAttendeeSchema>

// Response: Class attendees list
export const ClassAttendeesResponseSchema = z.object({
  classId: UuidSchema,
  attendees: z.array(ClassAttendeeSchema),
  total: z.number().int().nonnegative(),
  confirmedCount: z.number().int().nonnegative(),
  attendedCount: z.number().int().nonnegative(),
})
export type ClassAttendeesResponse = z.infer<typeof ClassAttendeesResponseSchema>
