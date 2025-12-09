import { z } from 'zod'

export const UuidSchema = z.string().uuid('Invalid UUID format')

export const EmailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .max(255)

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)

export const PhoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional()

export const DateTimeSchema = z.string().datetime('Invalid datetime format')

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

export const PaginationSchema = z.object({
  page: z.number().int().positive('Page must be a positive integer'),
  pageSize: z.number().int().min(1).max(100, 'Page size must be between 1 and 100'),
})

export const PaginatedMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
})

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  timestamp: z.string().datetime(),
})

export const SuccessResponseSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    success: z.literal(true),
    data: schema,
    timestamp: z.string().datetime(),
  })

export const GenericResponseSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([
    SuccessResponseSchema(schema),
    ErrorResponseSchema,
  ])

export const BaseTimestampsSchema = z.object({
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
})

export const SoftDeleteSchema = BaseTimestampsSchema.extend({
  deletedAt: DateTimeSchema.nullable(),
})

export const RoleSchema = z.enum(['user', 'admin', 'instructor'])

export const ClassLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'all_levels'])

export type Uuid = z.infer<typeof UuidSchema>
export type Email = z.infer<typeof EmailSchema>
export type Password = z.infer<typeof PasswordSchema>
export type Phone = z.infer<typeof PhoneSchema>
export type DateTime = z.infer<typeof DateTimeSchema>
export type Date = z.infer<typeof DateSchema>
export type Pagination = z.infer<typeof PaginationSchema>
export type PaginatedMeta = z.infer<typeof PaginatedMetaSchema>
export type Role = z.infer<typeof RoleSchema>
export type ClassLevel = z.infer<typeof ClassLevelSchema>
