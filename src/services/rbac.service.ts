import { supabase, getSupabaseAdminClient } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import type { UserRole, PermissionAction, PermissionResource } from '@/api/schemas'

// =====================================================
// ROLE HIERARCHY
// =====================================================

const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 6,
  admin: 5,
  staff: 4,
  receptionist: 4,
  instructor: 3,
  user: 1,
}

// =====================================================
// PERMISSION MATRIX
// Define what each role can do
// =====================================================

const PERMISSION_MATRIX: Record<UserRole, Record<PermissionResource, PermissionAction[]>> = {
  super_admin: {
    users: ['view_all', 'view_own', 'edit_all', 'edit_own', 'delete', 'change_role', 'flag', 'unflag', 'suspend', 'activate', 'reset_password', 'view_notes', 'edit_notes'],
    packages: ['view', 'create', 'edit_all', 'delete', 'activate', 'deactivate'],
    classes: ['view', 'create', 'edit_all', 'cancel_all'],
    bookings: ['view_all', 'view_own', 'create', 'cancel_all', 'cancel_own'],
    attendance: ['view_all', 'view_own', 'check_in', 'mark_no_show', 'excuse', 'penalize', 'resolve'],
    tokens: ['view_all', 'view_own', 'adjust'],
    analytics: ['view', 'export'],
    settings: ['system', 'gym'],
    staff: ['view', 'create', 'edit', 'delete', 'suspend', 'reset_password'],
    waitlist: ['view_all', 'view_own', 'manage'],
    refunds: ['view_all', 'create', 'approve'],
    payments: ['view_all'],
    invoices: ['view_all', 'create'],
    rooms: ['view', 'create', 'edit', 'delete'],
    notifications: ['send', 'view_all', 'manage_templates'],
  },
  admin: {
    users: ['view_all', 'view_own', 'edit_all', 'edit_own', 'flag', 'unflag', 'suspend', 'activate', 'reset_password', 'view_notes', 'edit_notes'],
    packages: ['view', 'create', 'edit_all', 'delete', 'activate', 'deactivate'],
    classes: ['view', 'create', 'edit_all', 'cancel_all'],
    bookings: ['view_all', 'view_own', 'create', 'cancel_all', 'cancel_own'],
    attendance: ['view_all', 'view_own', 'check_in', 'mark_no_show', 'excuse', 'penalize', 'resolve'],
    tokens: ['view_all', 'view_own', 'adjust'],
    analytics: ['view', 'export'],
    settings: ['gym'],
    staff: ['view', 'create', 'edit', 'reset_password'],
    waitlist: ['view_all', 'view_own', 'manage'],
    refunds: ['view_all', 'create', 'approve'],
    payments: ['view_all'],
    invoices: ['view_all', 'create'],
    rooms: ['view', 'create', 'edit', 'delete'],
    notifications: ['send', 'view_all', 'manage_templates'],
  },
  instructor: {
    users: ['view_own', 'edit_own'],
    packages: ['view'],
    classes: ['view', 'create', 'edit_own', 'cancel_own'],
    bookings: ['view_own', 'cancel_own'],
    attendance: ['view_own', 'check_in', 'mark_no_show', 'excuse', 'penalize', 'resolve'],
    tokens: ['view_own'],
    analytics: [],
    settings: [],
    staff: [],
    waitlist: ['view_own'],
    refunds: [],
    payments: [],
    invoices: [],
    rooms: [],
    notifications: [],
  },
  staff: {
    users: ['view_all', 'view_own', 'edit_all', 'flag', 'unflag', 'view_notes', 'edit_notes'],
    packages: ['view', 'create'],
    classes: ['view', 'create', 'edit_all'],
    bookings: ['view_all', 'view_own', 'create', 'cancel_all', 'cancel_own'],
    attendance: ['view_all', 'view_own', 'check_in', 'mark_no_show', 'excuse', 'penalize', 'resolve'],
    tokens: ['view_all', 'view_own', 'adjust'],
    analytics: ['view'],
    settings: [],
    staff: [],
    waitlist: ['view_all', 'manage'],
    refunds: [],
    payments: [],
    invoices: [],
    rooms: ['view'],
    notifications: [],
  },
  receptionist: {
    users: ['view_all', 'view_own', 'flag', 'view_notes'],
    packages: ['view'],
    classes: ['view'],
    bookings: ['view_all', 'view_own', 'create', 'cancel_all', 'cancel_own'],
    attendance: ['view_all', 'view_own', 'check_in', 'mark_no_show', 'excuse', 'penalize', 'resolve'],
    tokens: ['view_all', 'view_own'],
    analytics: [],
    settings: [],
    staff: [],
    waitlist: ['view_all', 'manage'],
    refunds: [],
    payments: [],
    invoices: [],
    rooms: ['view'],
    notifications: [],
  },
  user: {
    users: ['view_own', 'edit_own'],
    packages: ['view', 'purchase'],
    classes: ['view'],
    bookings: ['view_own', 'create', 'cancel_own'],
    attendance: ['view_own'],
    tokens: ['view_own'],
    analytics: [],
    settings: [],
    staff: [],
    waitlist: ['view_own', 'manage'],
    refunds: [],
    payments: [],
    invoices: [],
    rooms: [],
    notifications: [],
  },
}

// =====================================================
// GET USER ROLE
// =====================================================

export async function getUserRole(userId: string): Promise<UserRole> {
  const { data, error } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) {
    // Default to user role if not found
    return 'user'
  }

  return data.role as UserRole
}

// =====================================================
// CHECK ROLE LEVEL
// =====================================================

export function isRoleAtLeast(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function isAdmin(role: UserRole): boolean {
  return isRoleAtLeast(role, 'admin')
}

export function isInstructor(role: UserRole): boolean {
  return isRoleAtLeast(role, 'instructor')
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'super_admin'
}

// =====================================================
// CHECK PERMISSION
// =====================================================

export function hasPermission(
  role: UserRole,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  const permissions = PERMISSION_MATRIX[role]?.[resource] || []
  return permissions.includes(action)
}

export async function checkPermission(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction
): Promise<boolean> {
  const role = await getUserRole(userId)
  return hasPermission(role, resource, action)
}

// =====================================================
// REQUIRE PERMISSION (throws if not allowed)
// =====================================================

export async function requirePermission(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction
): Promise<UserRole> {
  const role = await getUserRole(userId)
  
  if (!hasPermission(role, resource, action)) {
    throw new ApiError(
      'AUTHORIZATION_ERROR',
      `Permission denied: ${resource}.${action}`,
      403
    )
  }
  
  return role
}

// =====================================================
// REQUIRE ROLE (throws if not at level)
// =====================================================

export async function requireRole(
  userId: string,
  requiredRole: UserRole
): Promise<UserRole> {
  const role = await getUserRole(userId)
  
  if (!isRoleAtLeast(role, requiredRole)) {
    throw new ApiError(
      'AUTHORIZATION_ERROR',
      `Required role: ${requiredRole} or above`,
      403
    )
  }
  
  return role
}

// =====================================================
// RESOURCE OWNERSHIP CHECKS
// =====================================================

export async function isClassOwner(userId: string, classId: string): Promise<boolean> {
  const { data } = await getSupabaseAdminClient()
    .from('classes')
    .select('instructor_id')
    .eq('id', classId)
    .single()

  return data?.instructor_id === userId
}

export async function isBookingOwner(userId: string, bookingId: string): Promise<boolean> {
  const { data } = await getSupabaseAdminClient()
    .from('bookings')
    .select('user_id')
    .eq('id', bookingId)
    .single()

  return data?.user_id === userId
}

export async function isClassInstructor(userId: string, classId: string): Promise<boolean> {
  const { data } = await getSupabaseAdminClient()
    .from('classes')
    .select('instructor_id')
    .eq('id', classId)
    .single()

  return data?.instructor_id === userId
}

// =====================================================
// COMBINED PERMISSION + OWNERSHIP CHECKS
// =====================================================

export async function canEditClass(userId: string, classId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  
  // Admins can edit any class
  if (hasPermission(role, 'classes', 'edit_all')) {
    return true
  }
  
  // Instructors can edit their own classes
  if (hasPermission(role, 'classes', 'edit_own')) {
    return await isClassOwner(userId, classId)
  }
  
  return false
}

export async function canCancelClass(userId: string, classId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  
  // Admins can cancel any class
  if (hasPermission(role, 'classes', 'cancel_all')) {
    return true
  }
  
  // Instructors can cancel their own classes
  if (hasPermission(role, 'classes', 'cancel_own')) {
    return await isClassOwner(userId, classId)
  }
  
  return false
}

export async function canViewBooking(userId: string, bookingId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  
  // Admins can view any booking
  if (hasPermission(role, 'bookings', 'view_all')) {
    return true
  }
  
  // Users can view their own bookings
  if (hasPermission(role, 'bookings', 'view_own')) {
    return await isBookingOwner(userId, bookingId)
  }
  
  return false
}

export async function canCancelBooking(userId: string, bookingId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  
  // Admins can cancel any booking
  if (hasPermission(role, 'bookings', 'cancel_all')) {
    return true
  }
  
  // Users can cancel their own bookings
  if (hasPermission(role, 'bookings', 'cancel_own')) {
    return await isBookingOwner(userId, bookingId)
  }
  
  return false
}

export async function canCheckInClass(userId: string, classId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  
  // Admins can check in any class
  if (isAdmin(role)) {
    return true
  }
  
  // Instructors can check in their own classes
  if (hasPermission(role, 'attendance', 'check_in')) {
    return await isClassInstructor(userId, classId)
  }
  
  return false
}

// =====================================================
// AUDIT LOGGING
// =====================================================

export async function createAuditLog(params: {
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  const { error } = await getSupabaseAdminClient().from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    old_values: params.oldValues,
    new_values: params.newValues,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
  })

  if (error) {
    console.error('[RBAC] Failed to create audit log:', error)
    // Don't throw - audit logging shouldn't break the main operation
  }
}

// =====================================================
// GET USER PERMISSIONS
// =====================================================

export async function getUserPermissions(userId: string): Promise<{
  role: UserRole
  permissions: Record<PermissionResource, PermissionAction[]>
}> {
  const role = await getUserRole(userId)
  return {
    role,
    permissions: PERMISSION_MATRIX[role],
  }
}

// =====================================================
// VERIFY JWT & EXTRACT USER
// =====================================================

export async function verifyAuthAndGetUser(authHeader: string | null): Promise<{
  userId: string
  role: UserRole
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError('AUTHENTICATION_ERROR', 'Missing or invalid authorization header', 401)
  }

  const token = authHeader.substring(7)
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    throw new ApiError('AUTHENTICATION_ERROR', 'Invalid or expired token', 401)
  }

  const role = await getUserRole(user.id)
  
  return {
    userId: user.id,
    role,
  }
}
