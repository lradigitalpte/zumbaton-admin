import { z } from 'zod'
import { UuidSchema, DateTimeSchema, BaseTimestampsSchema } from './common'
import { PackageSchema } from './package'

// User package status - aligned with TOKEN_ENGINE_PLAN.md
export const UserPackageStatusSchema = z.enum([
  'active',
  'expired',
  'depleted',
  'frozen',
  'refunded'
])
export type UserPackageStatus = z.infer<typeof UserPackageStatusSchema>

// User package entity - matches Supabase 'user_packages' table
export const UserPackageSchema = BaseTimestampsSchema.extend({
  id: UuidSchema,
  userId: UuidSchema,
  packageId: UuidSchema,
  tokensRemaining: z.number().int().nonnegative(),
  tokensHeld: z.number().int().nonnegative().default(0),
  purchasedAt: DateTimeSchema,
  expiresAt: DateTimeSchema,
  frozenAt: DateTimeSchema.nullable(),
  frozenUntil: DateTimeSchema.nullable(),
  status: UserPackageStatusSchema.default('active'),
  paymentId: z.string().max(255).nullable(),
})
export type UserPackage = z.infer<typeof UserPackageSchema>

// User package with package details (joined data)
export const UserPackageWithDetailsSchema = UserPackageSchema.extend({
  package: PackageSchema.optional(),
  tokensAvailable: z.number().int(), // computed: tokensRemaining - tokensHeld
})
export type UserPackageWithDetails = z.infer<typeof UserPackageWithDetailsSchema>

// Token balance summary (aggregated view)
export const TokenBalanceSchema = z.object({
  userId: UuidSchema,
  totalTokens: z.number().int().nonnegative(),
  heldTokens: z.number().int().nonnegative(),
  availableTokens: z.number().int().nonnegative(),
  nextExpiry: DateTimeSchema.nullable(),
  expiringTokens: z.number().int().nonnegative(), // tokens expiring within 7 days
  activePackages: z.number().int().nonnegative(),
})
export type TokenBalance = z.infer<typeof TokenBalanceSchema>

// Request: Purchase package
export const PurchasePackageRequestSchema = z.object({
  packageId: UuidSchema,
  paymentId: z.string().max(255).optional(), // from payment provider
})
export type PurchasePackageRequest = z.infer<typeof PurchasePackageRequestSchema>

// Response: Purchase confirmation
export const PurchaseResponseSchema = z.object({
  userPackage: UserPackageSchema,
  tokensAdded: z.number().int().positive(),
  newBalance: z.number().int().nonnegative(),
  expiresAt: DateTimeSchema,
  message: z.string(),
})
export type PurchaseResponse = z.infer<typeof PurchaseResponseSchema>

// Request: Freeze package
export const FreezePackageRequestSchema = z.object({
  freezeDays: z.number().int().positive().max(30, 'Maximum freeze is 30 days').default(7),
})
export type FreezePackageRequest = z.infer<typeof FreezePackageRequestSchema>

// Response: Freeze confirmation
export const FreezeResponseSchema = z.object({
  userPackageId: UuidSchema,
  frozenAt: DateTimeSchema,
  frozenUntil: DateTimeSchema,
  newExpiresAt: DateTimeSchema,
  message: z.string(),
})
export type FreezeResponse = z.infer<typeof FreezeResponseSchema>

// Request: Admin token adjustment
export const AdminTokenAdjustmentRequestSchema = z.object({
  userId: UuidSchema,
  userPackageId: UuidSchema.optional(), // if not provided, creates new adjustment package
  tokensChange: z.number().int().refine(val => val !== 0, 'Token change cannot be 0'),
  reason: z.string().min(1, 'Reason is required').max(500),
})
export type AdminTokenAdjustmentRequest = z.infer<typeof AdminTokenAdjustmentRequestSchema>

// Response: Token adjustment confirmation
export const TokenAdjustmentResponseSchema = z.object({
  userId: UuidSchema,
  tokensChange: z.number().int(),
  previousBalance: z.number().int().nonnegative(),
  newBalance: z.number().int().nonnegative(),
  transactionId: UuidSchema,
  message: z.string(),
})
export type TokenAdjustmentResponse = z.infer<typeof TokenAdjustmentResponseSchema>

// Response: User packages with balance
export const UserPackagesResponseSchema = z.object({
  packages: z.array(UserPackageWithDetailsSchema),
  balance: TokenBalanceSchema,
})
export type UserPackagesResponse = z.infer<typeof UserPackagesResponseSchema>

// Query: List user packages
export const UserPackagesQuerySchema = z.object({
  userId: UuidSchema.optional(), // admin can query any user
  status: UserPackageStatusSchema.optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})
export type UserPackagesQuery = z.infer<typeof UserPackagesQuerySchema>
