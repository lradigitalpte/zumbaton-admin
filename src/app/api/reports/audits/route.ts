/**
 * Audits Reports API
 * GET /api/reports/audits - Get comprehensive audit logs (admin/super_admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { ApiError } from '@/lib/api-error'

export async function GET(request: NextRequest) {
  try {
    // Check authentication and role
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Only admin and super_admin can view audits
    if (!['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can view audit logs' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const supabase = getSupabaseAdminClient()
    
    const action = searchParams.get('action') || undefined
    const resourceType = searchParams.get('resourceType') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const search = searchParams.get('search') || undefined
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50

    // Build query for audit logs
    let query = supabase
      .from(TABLES.AUDIT_LOGS)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filter by action
    if (action && action !== 'all') {
      query = query.eq('action', action)
    }

    // Filter by resource type
    if (resourceType && resourceType !== 'all') {
      query = query.eq('resource_type', resourceType)
    }

    // Filter by date range
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data: auditLogs, error, count } = await query

    if (error) {
      throw new ApiError('SERVER_ERROR', 'Failed to fetch audit logs', 500, error)
    }

    // Get unique user IDs to fetch user profiles
    const userIds = [...new Set((auditLogs || []).map((log: { user_id: string | null }) => log.user_id).filter(Boolean))]
    
    // Fetch user profiles
    let userProfiles: Record<string, { name: string | null; email: string | null; role: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from(TABLES.USER_PROFILES)
        .select('id, name, email, role')
        .in('id', userIds)

      if (profiles) {
        userProfiles = profiles.reduce((acc: Record<string, { name: string | null; email: string | null; role: string | null }>, p: { id: string; name: string | null; email: string | null; role: string | null }) => {
          acc[p.id] = { name: p.name, email: p.email, role: p.role }
          return acc
        }, {})
      }
    }

    // Transform audit logs with user data
    let result = (auditLogs || []).map((log: {
      id: string
      user_id: string | null
      action: string
      resource_type: string
      resource_id: string | null
      old_values: Record<string, unknown> | null
      new_values: Record<string, unknown> | null
      ip_address: string | null
      user_agent: string | null
      created_at: string
    }) => {
      const userProfile = log.user_id ? (userProfiles[log.user_id] || {}) : null
      
      return {
        id: log.id,
        userId: log.user_id,
        userName: userProfile?.name || 'System',
        userEmail: userProfile?.email || null,
        userRole: userProfile?.role || null,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        oldValues: log.old_values,
        newValues: log.new_values,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        createdAt: log.created_at,
      }
    })

    // Client-side search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((log: { userName: string; userEmail: string | null; action: string; resourceType: string }) => 
        log.userName.toLowerCase().includes(searchLower) ||
        (log.userEmail && log.userEmail.toLowerCase().includes(searchLower)) ||
        log.action.toLowerCase().includes(searchLower) ||
        log.resourceType.toLowerCase().includes(searchLower)
      )
    }

    // Calculate summary stats
    const { data: allLogs } = await supabase
      .from(TABLES.AUDIT_LOGS)
      .select('action, resource_type, created_at')

    const stats = {
      totalLogs: count || 0,
      todayLogs: 0,
      uniqueUsers: 0,
      uniqueActions: 0,
      uniqueResources: 0,
    }

    const today = new Date().toISOString().split('T')[0]
    const uniqueUserIds = new Set<string>()
    const uniqueActionsSet = new Set<string>()
    const uniqueResourcesSet = new Set<string>()
    
    if (allLogs) {
      for (const log of allLogs) {
        if (log.created_at && log.created_at.startsWith(today)) {
          stats.todayLogs++
        }
        if (log.action) {
          uniqueActionsSet.add(log.action)
        }
        if (log.resource_type) {
          uniqueResourcesSet.add(log.resource_type)
        }
      }
    }

    // Count unique users from current page results
    if (auditLogs) {
      auditLogs.forEach((log: { user_id: string | null }) => {
        if (log.user_id) {
          uniqueUserIds.add(log.user_id)
        }
      })
      stats.uniqueUsers = uniqueUserIds.size
    }

    stats.uniqueActions = uniqueActionsSet.size
    stats.uniqueResources = uniqueResourcesSet.size

    return NextResponse.json({
      success: true,
      data: {
        logs: result,
        stats,
        total: count || 0,
        page,
        pageSize,
        hasMore: (count || 0) > page * pageSize,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// Error handler helper
function handleApiError(error: unknown) {
  console.error('[API /reports/audits]', error)

  if (error instanceof ApiError) {
    return NextResponse.json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    }, { status: error.statusCode })
  }

  return NextResponse.json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  }, { status: 500 })
}
