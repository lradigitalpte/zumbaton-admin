/**
 * User Management API Routes
 * GET /api/users - List users (admin only)
 * POST /api/users - Create user profile (internal)
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { listUsers, createUser } from '@/services/user.service'
import { createAuditLog } from '@/services/rbac.service'
import { CreateUserProfileRequestSchema, UserListQuerySchema } from '@/api/schemas/user'
import { cachedResponse, CACHE_PRESETS } from '@/lib/api-cache'

/**
 * GET /api/users - List all users (admin only)
 */
async function handleGetUsers(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    // Parse query parameters
    const url = new URL(request.url)
    
    // Helper to safely get query params (converts null to undefined for optional fields)
    const getParam = (key: string): string | undefined => {
      const value = url.searchParams.get(key)
      return value === null ? undefined : value
    }
    
    // Build query object - only include defined values
    const queryData: Record<string, unknown> = {}
    
    const pageParam = getParam('page')
    queryData.page = pageParam || 1
    
    const pageSizeParam = getParam('pageSize') || getParam('limit')
    queryData.pageSize = pageSizeParam || 20
    
    const roleParam = getParam('role')
    if (roleParam) queryData.role = roleParam
    
    const isActiveParam = getParam('isActive')
    if (isActiveParam !== undefined && isActiveParam !== '') {
      queryData.isActive = isActiveParam // Zod will coerce string "true"/"false" to boolean
    }
    
    const isFlaggedParam = getParam('isFlagged')
    if (isFlaggedParam !== undefined && isFlaggedParam !== '') {
      queryData.isFlagged = isFlaggedParam // Zod will coerce string "true"/"false" to boolean
    }
    
    const searchParam = getParam('search')
    if (searchParam) queryData.search = searchParam
    
    queryData.sortBy = getParam('sortBy') || 'createdAt'
    queryData.sortOrder = getParam('sortOrder') || 'desc'
    
    const queryResult = UserListQuerySchema.safeParse(queryData)

    if (!queryResult.success) {
      console.error('[Users API] Query validation failed:', JSON.stringify(queryResult.error.issues, null, 2))
      console.error('[Users API] Query data received:', JSON.stringify(queryData, null, 2))
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid query parameters', details: queryResult.error.issues },
        { status: 400 }
      )
    }

    const result = await listUsers(context.user.id, queryResult.data)

    // Log the action asynchronously (don't block response)
    createAuditLog({
      userId: context.user.id,
      action: 'list_users',
      resourceType: 'users',
      newValues: { filters: queryResult.data }
    }).catch(err => {
      console.error('[Users API] Failed to create audit log:', err)
      // Don't fail the request if audit log fails
    })

    // Return cached response - reduces Next.js → Supabase calls
    return cachedResponse({
      data: result.users,
      pagination: result.meta
    }, CACHE_PRESETS.users)
  } catch (error) {
    console.error('Error listing users:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to list users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users - Create a new user profile
 * This is typically called after auth signup
 */
async function handleCreateUser(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const body = await request.json()
    const parseResult = CreateUserProfileRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const profile = await createUser(context.user.id, parseResult.data)

    // Invalidate Next.js cache for users list
    revalidatePath('/api/users')
    revalidatePath('/users')

    return NextResponse.json({ data: profile }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// Export handlers with RBAC protection
export const GET = withAuth(handleGetUsers, { requiredRole: 'admin' })
export const POST = withAuth(handleCreateUser, { requiredRole: 'admin' })
