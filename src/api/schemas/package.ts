import { z } from 'zod'
import { UuidSchema, DateTimeSchema, BaseTimestampsSchema } from './common'

// Class types available in the system
export const ClassTypeSchema = z.enum([
  'zumba',
  'yoga',
  'pilates',
  'hiit',
  'spinning',
  'boxing',
  'dance',
  'strength',
  'cardio',
  'all'
])
export type ClassType = z.infer<typeof ClassTypeSchema>

// Package entity - matches Supabase 'packages' table
export const PackageSchema = BaseTimestampsSchema.extend({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  tokenCount: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default('USD'),
  validityDays: z.number().int().positive(),
  classTypes: z.array(ClassTypeSchema).default(['all']),
  isActive: z.boolean().default(true),
})
export type Package = z.infer<typeof PackageSchema>

// Request: Create package (admin only)
export const CreatePackageRequestSchema = z.object({
  name: z.string().min(1, 'Package name is required').max(100),
  description: z.string().max(500).optional(),
  tokenCount: z.number().int().positive('Token count must be positive'),
  priceCents: z.number().int().nonnegative('Price cannot be negative'),
  currency: z.string().length(3).default('USD'),
  validityDays: z.number().int().positive('Validity must be at least 1 day'),
  classTypes: z.array(ClassTypeSchema).default(['all']),
  isActive: z.boolean().default(true),
})
export type CreatePackageRequest = z.infer<typeof CreatePackageRequestSchema>

// Request: Update package (admin only)
export const UpdatePackageRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  tokenCount: z.number().int().positive().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  validityDays: z.number().int().positive().optional(),
  classTypes: z.array(ClassTypeSchema).optional(),
  isActive: z.boolean().optional(),
})
export type UpdatePackageRequest = z.infer<typeof UpdatePackageRequestSchema>

// Response: Single package
export const PackageResponseSchema = z.object({
  package: PackageSchema,
})
export type PackageResponse = z.infer<typeof PackageResponseSchema>

// Response: Package list with pagination
export const PackageListResponseSchema = z.object({
  packages: z.array(PackageSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
})
export type PackageListResponse = z.infer<typeof PackageListResponseSchema>

// Query: List packages
export const PackageListQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  isActive: z.boolean().optional(),
  classType: ClassTypeSchema.optional(),
})
export type PackageListQuery = z.infer<typeof PackageListQuerySchema>
