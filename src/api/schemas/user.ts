import { z } from 'zod'

// =====================================================
// ROLE TYPES
// =====================================================

export const UserRoleSchema = z.enum(['super_admin', 'admin', 'instructor', 'staff', 'receptionist', 'user'])
export type UserRole = z.infer<typeof UserRoleSchema>

// =====================================================
// USER PROFILE SCHEMAS
// =====================================================

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  role: UserRoleSchema,
  isActive: z.boolean(),
  noShowCount: z.number().int().min(0),
  isFlagged: z.boolean(),
  preferences: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  physicalFormUrl: z.string().url().nullable().optional(),
  registrationFormId: z.string().uuid().nullable().optional(),
  registrationFormSentAt: z.string().datetime().nullable().optional(),
  earlyBirdEligible: z.boolean().optional(),
  earlyBirdGrantedAt: z.string().datetime().nullable().optional(),
  earlyBirdExpiresAt: z.string().datetime().nullable().optional(),
})

export type UserProfile = z.infer<typeof UserProfileSchema>

// =====================================================
// USER STATS SCHEMAS
// =====================================================

export const UserStatsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  totalClassesAttended: z.number().int().min(0),
  totalClassesBooked: z.number().int().min(0),
  totalNoShows: z.number().int().min(0),
  totalLateCancels: z.number().int().min(0),
  totalTokensPurchased: z.number().int().min(0),
  totalTokensUsed: z.number().int().min(0),
  totalSpentCents: z.number().int().min(0),
  favoriteClassType: z.string().nullable().optional(),
  favoriteInstructorId: z.string().uuid().nullable().optional(),
  streakCurrent: z.number().int().min(0),
  streakLongest: z.number().int().min(0),
  lastClassAt: z.string().datetime().nullable().optional(),
  memberSince: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type UserStats = z.infer<typeof UserStatsSchema>

// =====================================================
// USER PROFILE WITH STATS (combined view)
// =====================================================

export const UserProfileWithStatsSchema = UserProfileSchema.extend({
  stats: UserStatsSchema.optional(),
  currentTokenBalance: z.number().int().min(0).optional(),
  currentAvailableTokens: z.number().int().min(0).optional(),
})

export type UserProfileWithStats = z.infer<typeof UserProfileWithStatsSchema>

// =====================================================
// REQUEST SCHEMAS
// =====================================================

export const CreateUserProfileRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  phone: z.string().optional(),
  role: UserRoleSchema.default('user'),
  password: z.string().min(8).max(128), // For auth.users creation
  dateOfBirth: z.string().optional(), // ISO date string
  bloodGroup: z.string().optional(), // e.g., "A+", "B-", "O+", "AB+"
  physicalFormUrl: z.string().url().optional(), // URL to uploaded physical form
  username: z.string().min(1).max(100).optional(), // For child accounts: login identifier (unique)
  guardianEmail: z.string().email().optional(), // For child accounts: parent/guardian email (receipts, payments)
})

export type CreateUserProfileRequest = z.infer<typeof CreateUserProfileRequestSchema>

export const UpdateUserProfileRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  preferences: z.record(z.unknown()).optional(),
})

export type UpdateUserProfileRequest = z.infer<typeof UpdateUserProfileRequestSchema>

export const UpdateUserRoleRequestSchema = z.object({
  role: UserRoleSchema,
})

export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleRequestSchema>

export const UpdateUserStatusRequestSchema = z.object({
  isActive: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
})

export type UpdateUserStatusRequest = z.infer<typeof UpdateUserStatusRequestSchema>

export const UpdateUserProfileAdminRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(), // ISO date string
  gender: z.string().nullable().optional(), // e.g., "Male", "Female", "Not sure"
  bloodGroup: z.string().nullable().optional(), // e.g., "A+", "B-", "O+", "AB+"
  preferences: z.record(z.unknown()).optional(),
})

export type UpdateUserProfileAdminRequest = z.infer<typeof UpdateUserProfileAdminRequestSchema>

// =====================================================
// QUERY SCHEMAS
// =====================================================

export const UserListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: UserRoleSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  isFlagged: z.coerce.boolean().optional(),
  search: z.string().optional(), // Search by name or email
  sortBy: z.enum(['name', 'email', 'createdAt', 'role']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type UserListQuery = z.infer<typeof UserListQuerySchema>

// =====================================================
// RESPONSE SCHEMAS
// =====================================================

export const UserListResponseSchema = z.object({
  users: z.array(UserProfileSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasMore: z.boolean(),
  }),
})

export type UserListResponse = z.infer<typeof UserListResponseSchema>

// =====================================================
// AUDIT LOG SCHEMAS
// =====================================================

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().uuid().nullable(),
  oldValues: z.record(z.unknown()).nullable(),
  newValues: z.record(z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export type AuditLog = z.infer<typeof AuditLogSchema>

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>

// =====================================================
// PERMISSION SCHEMAS
// =====================================================

export const PermissionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  resource: z.string(),
  action: z.string(),
  createdAt: z.string().datetime(),
})

export type Permission = z.infer<typeof PermissionSchema>

export const RolePermissionSchema = z.object({
  id: z.string().uuid(),
  role: UserRoleSchema,
  permissionId: z.string().uuid(),
  createdAt: z.string().datetime(),
})

export type RolePermission = z.infer<typeof RolePermissionSchema>

// Permission check types
export type PermissionAction = 
  | 'view_all' | 'view_own' 
  | 'create' | 'edit_all' | 'edit_own' | 'edit'
  | 'delete' | 'cancel_all' | 'cancel_own'
  | 'purchase' | 'check_in' | 'mark_no_show' | 'adjust'
  | 'view' | 'export' | 'system' | 'gym' | 'change_role'
  | 'flag' | 'unflag' | 'suspend' | 'activate' | 'reset_password'
  | 'view_notes' | 'edit_notes'
  | 'excuse' | 'penalize' | 'resolve'
  | 'deactivate'
  | 'manage' | 'send' | 'manage_templates'
  | 'approve'

export type PermissionResource = 
  | 'users' | 'packages' | 'classes' | 'bookings' 
  | 'attendance' | 'tokens' | 'analytics' | 'settings'
  | 'staff' | 'waitlist' | 'refunds' | 'payments' 
  | 'invoices' | 'rooms' | 'notifications'
