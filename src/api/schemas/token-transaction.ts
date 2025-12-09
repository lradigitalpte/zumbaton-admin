import { z } from 'zod'
import { UuidSchema, DateTimeSchema } from './common'

// Transaction type - aligned with TOKEN_ENGINE_PLAN.md
export const TransactionTypeSchema = z.enum([
  'purchase',
  'booking-hold',
  'booking-release',
  'attendance-consume',
  'no-show-consume',
  'late-cancel-consume',
  'admin-adjust',
  'refund',
  'expire'
])
export type TransactionType = z.infer<typeof TransactionTypeSchema>

// Token transaction entity - matches Supabase 'token_transactions' table
// This is the audit log for all token changes
export const TokenTransactionSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  userPackageId: UuidSchema.nullable(),
  bookingId: UuidSchema.nullable(),
  transactionType: TransactionTypeSchema,
  tokensChange: z.number().int(), // positive = add, negative = subtract
  tokensBefore: z.number().int().nonnegative(),
  tokensAfter: z.number().int().nonnegative(),
  description: z.string().max(500).nullable(),
  performedBy: UuidSchema.nullable(), // admin user if manual adjustment
  createdAt: DateTimeSchema,
})
export type TokenTransaction = z.infer<typeof TokenTransactionSchema>

// Transaction with user info (for admin view)
export const TokenTransactionWithUserSchema = TokenTransactionSchema.extend({
  userName: z.string(),
  userEmail: z.string().email(),
  performedByName: z.string().nullable(),
})
export type TokenTransactionWithUser = z.infer<typeof TokenTransactionWithUserSchema>

// Query: Transaction list
export const TransactionQuerySchema = z.object({
  userId: UuidSchema.optional(),
  userPackageId: UuidSchema.optional(),
  transactionType: TransactionTypeSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})
export type TransactionQuery = z.infer<typeof TransactionQuerySchema>

// Transaction summary (aggregated stats)
export const TransactionSummarySchema = z.object({
  totalPurchased: z.number().int().nonnegative(),
  totalConsumed: z.number().int().nonnegative(),
  totalRefunded: z.number().int().nonnegative(),
  totalExpired: z.number().int().nonnegative(),
  totalAdjusted: z.number().int(), // can be negative
  netChange: z.number().int(),
})
export type TransactionSummary = z.infer<typeof TransactionSummarySchema>

// Response: Transaction list (admin)
export const TransactionListResponseSchema = z.object({
  transactions: z.array(TokenTransactionWithUserSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
  summary: TransactionSummarySchema,
})
export type TransactionListResponse = z.infer<typeof TransactionListResponseSchema>

// Response: User transaction history
export const UserTransactionHistorySchema = z.object({
  transactions: z.array(TokenTransactionSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
})
export type UserTransactionHistory = z.infer<typeof UserTransactionHistorySchema>
