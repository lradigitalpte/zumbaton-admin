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
    const scope = searchParams.get('scope') === 'all' ? 'all' : 'changes'
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50

    const sgtToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const todayStart = `${sgtToday}T00:00:00+08:00`
    const dayBound = (value: string, end: boolean) => (
      value.includes('T') ? value : `${value}T${end ? '23:59:59.999' : '00:00:00'}+08:00`
    )

    // Build query for audit logs
    let query = supabase
      .from(TABLES.AUDIT_LOGS)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (scope === 'changes') {
      query = query.not('action', 'like', 'list_%')
    }

    const actionTerms: Record<string, string[]> = {
      create: ['create'],
      update: ['update', 'edit'],
      delete: ['delete', 'cancel', 'deactivat'],
      adjust: ['adjust'],
      payment: ['payment', 'refund'],
      attendance: ['check_in', 'no_show'],
    }
    if (resourceType && resourceType !== 'all') {
      query = query.ilike('resource_type', `%${resourceType}%`)
    }

    if (startDate) {
      query = query.gte('created_at', dayBound(startDate, false))
    }
    if (endDate) {
      query = query.lte('created_at', dayBound(endDate, true))
    }

    const term = (search || '').replace(/[^a-zA-Z0-9 @.+_-]/g, '').trim()
    const actionFilters = action && action !== 'all'
      ? (actionTerms[action] || [action]).map((piece) => `action.ilike.%${piece}%`)
      : []
    let searchFilters: string[] = []
    if (term) {
      const { data: people } = await supabase
        .from(TABLES.USER_PROFILES)
        .select('id')
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(40)
      const ids = (people || []).map((person: { id: string }) => person.id)
      searchFilters = [`action.ilike.%${term}%`, `resource_type.ilike.%${term}%`]
      if (ids.length > 0) searchFilters.push(`user_id.in.(${ids.join(',')})`)
    }
    if (actionFilters.length > 0 && searchFilters.length > 0) {
      const combined = actionFilters.flatMap((actionFilter) => searchFilters.map((searchFilter) => `and(${actionFilter},${searchFilter})`))
      query = query.or(combined.join(','))
    } else if (actionFilters.length > 0) {
      query = query.or(actionFilters.join(','))
    } else if (searchFilters.length > 0) {
      query = query.or(searchFilters.join(','))
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

    const [{ count: changeCount }, { count: todayCount }, { count: readCount }, { data: changeRows }] = await Promise.all([
      supabase.from(TABLES.AUDIT_LOGS).select('*', { count: 'exact', head: true }).not('action', 'like', 'list_%'),
      supabase.from(TABLES.AUDIT_LOGS).select('*', { count: 'exact', head: true }).not('action', 'like', 'list_%').gte('created_at', todayStart),
      supabase.from(TABLES.AUDIT_LOGS).select('*', { count: 'exact', head: true }).like('action', 'list_%'),
      supabase.from(TABLES.AUDIT_LOGS).select('user_id, action, resource_type').not('action', 'like', 'list_%').limit(3000),
    ])

    const uniqueUserIds = new Set<string>()
    const uniqueActionsSet = new Set<string>()
    const uniqueResourcesSet = new Set<string>()
    for (const log of changeRows || []) {
      if (log.user_id) uniqueUserIds.add(log.user_id as string)
      if (log.action) uniqueActionsSet.add(log.action as string)
      if (log.resource_type) uniqueResourcesSet.add(log.resource_type as string)
    }

    const stats = {
      totalLogs: changeCount || 0,
      todayLogs: todayCount || 0,
      uniqueUsers: uniqueUserIds.size,
      uniqueActions: uniqueActionsSet.size,
      uniqueResources: uniqueResourcesSet.size,
      hiddenReads: readCount || 0,
    }

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
