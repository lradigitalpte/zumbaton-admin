/**
 * RBAC Middleware for Next.js API Routes
 * Protects routes based on user roles and permissions
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { UserRole, PermissionAction, PermissionResource } from '@/api/schemas/user'

export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
  permissions: Array<{
    resource: PermissionResource
    action: PermissionAction
  }>
}

export interface ProtectedRouteOptions {
  requiredRole?: UserRole
  requiredPermission?: {
    resource: PermissionResource
    action: PermissionAction
  }
  allowSelf?: boolean // Allow users to access their own resources
}

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  admin: 80,
  staff: 60,
  receptionist: 60,
  instructor: 50,
  user: 10
}

/**
 * Extract and validate user from request
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  try {
    // Get authorization header (check both cases)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader) {
      console.error('[RBAC] No authorization header found')
      return null
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.error('[RBAC] Authorization header does not start with Bearer:', authHeader.substring(0, 20))
      return null
    }

    const token = authHeader.substring(7).trim()
    if (!token) {
      console.error('[RBAC] No token found after Bearer prefix')
      return null
    }

    // Verify JWT with Supabase
    const supabaseAdmin = getSupabaseAdminClient()
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error) {
      console.error('[RBAC] Error verifying token:', error.message)
      return null
    }
    if (!user) {
      console.error('[RBAC] No user found for token')
      return null
    }

    // Get user profile with role and active status
    // Note: user_profiles.id is the same as auth.users.id (primary key reference)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      // Default to 'user' role if no profile exists
      return {
        id: user.id,
        email: user.email || '',
        role: 'user',
        permissions: []
      }
    }

    // Check if user is active - deactivated users cannot access the API
    if (profile.is_active === false) {
      console.warn('[RBAC] User account is deactivated:', user.email)
      return null // Return null to reject the request
    }

    // Get role permissions
    const { data: permissions } = await supabaseAdmin
      .from('role_permissions')
      .select(`
        permissions (
          resource,
          action
        )
      `)
      .eq('role', profile.role)

    const userPermissions = (permissions || []).map((p: unknown) => {
      const perm = p as { permissions: { resource: PermissionResource; action: PermissionAction } }
      return {
        resource: perm.permissions.resource,
        action: perm.permissions.action
      }
    })

    return {
      id: user.id,
      email: user.email || '',
      role: profile.role as UserRole,
      permissions: userPermissions
    }
  } catch {
    return null
  }
}

/**
 * Check if user has required role (or higher)
 */
export function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  user: AuthenticatedUser,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  // Super admin has all permissions
  if (user.role === 'super_admin') {
    return true
  }

  // Check explicit permissions
  return user.permissions.some(
    p => p.resource === resource && p.action === action
  )
}

/**
 * Create a protected route handler wrapper
 */
export function withAuth<T extends Record<string, unknown>>(
  handler: (
    request: NextRequest,
    context: { params: Promise<T>; user: AuthenticatedUser }
  ) => Promise<NextResponse>,
  options: ProtectedRouteOptions = {}
) {
  return async (
    request: NextRequest,
    context: { params: Promise<T> }
  ): Promise<NextResponse> => {
    // Get authenticated user
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check role requirement
    if (options.requiredRole && !hasRequiredRole(user.role, options.requiredRole)) {
      return NextResponse.json(
        { error: 'Forbidden', message: `Requires ${options.requiredRole} role or higher` },
        { status: 403 }
      )
    }

    // Check permission requirement
    if (options.requiredPermission) {
      const { resource, action } = options.requiredPermission
      if (!hasPermission(user, resource, action)) {
        return NextResponse.json(
          { error: 'Forbidden', message: `Missing permission: ${action} on ${resource}` },
          { status: 403 }
        )
      }
    }

    // Call the handler with user context
    return handler(request, { params: context.params, user })
  }
}

/**
 * Create middleware for checking if user is accessing their own resource
 */
export function withSelfOrAdmin<T extends { userId?: string }>(
  handler: (
    request: NextRequest,
    context: { params: Promise<T>; user: AuthenticatedUser }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context: { params: Promise<T> }
  ): Promise<NextResponse> => {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }

    const params = await context.params
    const targetUserId = params.userId

    // Allow if accessing own resource or is admin
    const isOwnResource = targetUserId === user.id || targetUserId === 'me'
    const isAdmin = hasRequiredRole(user.role, 'admin')

    if (!isOwnResource && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Can only access your own resource' },
        { status: 403 }
      )
    }

    return handler(request, { params: context.params, user })
  }
}

/**
 * Simple auth check without role/permission requirements
 */
export function withAuthentication<T extends Record<string, unknown>>(
  handler: (
    request: NextRequest,
    context: { params: Promise<T>; user: AuthenticatedUser }
  ) => Promise<NextResponse>
) {
  return withAuth(handler, {})
}

/**
 * Require admin role
 */
export function withAdmin<T extends Record<string, unknown>>(
  handler: (
    request: NextRequest,
    context: { params: Promise<T>; user: AuthenticatedUser }
  ) => Promise<NextResponse>
) {
  return withAuth(handler, { requiredRole: 'admin' })
}

/**
 * Require instructor role (or higher)
 */
export function withInstructor<T extends Record<string, unknown>>(
  handler: (
    request: NextRequest,
    context: { params: Promise<T>; user: AuthenticatedUser }
  ) => Promise<NextResponse>
) {
  return withAuth(handler, { requiredRole: 'instructor' })
}

/**
 * Require super admin role
 */
export function withSuperAdmin<T extends Record<string, unknown>>(
  handler: (
    request: NextRequest,
    context: { params: Promise<T>; user: AuthenticatedUser }
  ) => Promise<NextResponse>
) {
  return withAuth(handler, { requiredRole: 'super_admin' })
}

// Export types for use in API routes
export type ProtectedHandler<T extends Record<string, unknown> = Record<string, unknown>> = (
  request: NextRequest,
  context: { params: Promise<T>; user: AuthenticatedUser }
) => Promise<NextResponse>
