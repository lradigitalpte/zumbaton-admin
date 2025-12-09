// Token Adjustments API Route
// Manage manual token adjustments with workflow

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import { adminAdjustTokens, getUserTokenBalance } from '@/services/token.service'

// GET /api/tokens/adjustments - List all adjustments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined
    const search = searchParams.get('search') || undefined
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50

    const adminClient = getSupabaseAdminClient()
    
    let query = adminClient
      .from(TABLES.TOKEN_ADJUSTMENTS)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Filter by type
    if (type && type !== 'all') {
      query = query.eq('adjustment_type', type)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data: adjustments, error, count } = await query

    if (error) {
      throw new ApiError('SERVER_ERROR', 'Failed to fetch adjustments', 500, error)
    }

    // Get user IDs to fetch profiles
    const userIds = [...new Set([
      ...(adjustments || []).map((a: { user_id: string }) => a.user_id),
      ...(adjustments || []).filter((a: { requested_by: string | null }) => a.requested_by).map((a: { requested_by: string }) => a.requested_by),
      ...(adjustments || []).filter((a: { approved_by: string | null }) => a.approved_by).map((a: { approved_by: string }) => a.approved_by),
    ])]

    // Fetch user profiles
    let userProfiles: Record<string, { name: string | null; email: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from(TABLES.USER_PROFILES)
        .select('id, name, email')
        .in('id', userIds)

      if (profiles) {
        userProfiles = profiles.reduce((acc: Record<string, { name: string | null; email: string | null }>, p: { id: string; name: string | null; email: string | null }) => {
          acc[p.id] = { name: p.name, email: p.email }
          return acc
        }, {})
      }
    }

    // Transform data
    let result = (adjustments || []).map((a: {
      id: string
      user_id: string
      adjustment_type: string
      amount: number
      reason: string
      notes: string | null
      status: string
      requested_by: string | null
      requested_at: string
      approved_by: string | null
      approved_at: string | null
      completed_at: string | null
      balance_before: number | null
      balance_after: number | null
      transaction_id: string | null
      created_at: string
    }) => {
      const userProfile = userProfiles[a.user_id] || { name: null, email: null }
      const requestedByProfile = a.requested_by ? (userProfiles[a.requested_by] || { name: null, email: null }) : { name: null, email: null }
      const approvedByProfile = a.approved_by ? (userProfiles[a.approved_by] || { name: null, email: null }) : { name: null, email: null }
      
      return {
        id: a.id,
        oderId: a.id, // Using adjustment ID as order reference
        userId: a.user_id,
        userName: userProfile.name || 'Unknown User',
        userEmail: userProfile.email || '',
        type: a.adjustment_type,
        amount: a.amount,
        reason: a.reason,
        notes: a.notes,
        status: a.status,
        requestedBy: requestedByProfile.name || 'System',
        requestedAt: a.requested_at,
        approvedBy: approvedByProfile.name || null,
        approvedAt: a.approved_at,
        completedAt: a.completed_at,
        balanceBefore: a.balance_before,
        balanceAfter: a.balance_after,
        transactionId: a.transaction_id,
        createdAt: a.created_at,
      }
    })

    // Client-side search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((a: { userName: string; userEmail: string; reason: string; notes: string | null }) =>
        a.userName.toLowerCase().includes(searchLower) ||
        a.userEmail.toLowerCase().includes(searchLower) ||
        a.reason.toLowerCase().includes(searchLower) ||
        (a.notes && a.notes.toLowerCase().includes(searchLower))
      )
    }

    // Calculate stats
    const { data: allAdjustments } = await adminClient
      .from(TABLES.TOKEN_ADJUSTMENTS)
      .select('status, amount')

    const stats = {
      total: allAdjustments?.length || 0,
      pending: allAdjustments?.filter((a: { status: string }) => a.status === 'pending').length || 0,
      approved: allAdjustments?.filter((a: { status: string }) => a.status === 'approved').length || 0,
      completed: allAdjustments?.filter((a: { status: string }) => a.status === 'completed').length || 0,
      rejected: allAdjustments?.filter((a: { status: string }) => a.status === 'rejected').length || 0,
      totalCredits: allAdjustments
        ?.filter((a: { status: string; amount: number }) => a.status === 'completed' && a.amount > 0)
        .reduce((sum: number, a: { amount: number }) => sum + a.amount, 0) || 0,
      totalDebits: Math.abs(
        allAdjustments
          ?.filter((a: { status: string; amount: number }) => a.status === 'completed' && a.amount < 0)
          .reduce((sum: number, a: { amount: number }) => sum + a.amount, 0) || 0
      ),
    }

    return NextResponse.json({
      success: true,
      data: {
        adjustments: result,
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

// POST /api/tokens/adjustments - Create new adjustment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, type, amount, reason, notes, requestedBy } = body

    if (!userId || !type || amount === undefined || !reason) {
      throw new ApiError('VALIDATION_ERROR', 'userId, type, amount, and reason are required', 400)
    }

    const adminClient = getSupabaseAdminClient()

    // Validate user exists
    const { data: user } = await adminClient
      .from(TABLES.USER_PROFILES)
      .select('id')
      .eq('id', userId)
      .single()

    if (!user) {
      throw new ApiError('NOT_FOUND_ERROR', 'User not found', 404)
    }

    // Create adjustment
    const { data: adjustment, error } = await adminClient
      .from(TABLES.TOKEN_ADJUSTMENTS)
      .insert({
        user_id: userId,
        adjustment_type: type,
        amount: type === 'debit' ? -Math.abs(amount) : Math.abs(amount),
        reason,
        notes: notes || null,
        status: 'pending',
        requested_by: requestedBy || null,
        requested_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new ApiError('SERVER_ERROR', 'Failed to create adjustment', 500, error)
    }

    return NextResponse.json({
      success: true,
      data: { adjustment },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/tokens/adjustments - Update adjustment (approve, reject, complete)
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      throw new ApiError('VALIDATION_ERROR', 'Adjustment ID is required', 400)
    }

    const body = await request.json()
    const { action, performedBy } = body // action: 'approve' | 'reject' | 'complete'

    if (!action || !['approve', 'reject', 'complete'].includes(action)) {
      throw new ApiError('VALIDATION_ERROR', 'Valid action (approve, reject, complete) is required', 400)
    }

    const adminClient = getSupabaseAdminClient()

    // Get current adjustment
    const { data: adjustment, error: fetchError } = await adminClient
      .from(TABLES.TOKEN_ADJUSTMENTS)
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !adjustment) {
      throw new ApiError('NOT_FOUND_ERROR', 'Adjustment not found', 404)
    }

    // Validate workflow
    if (action === 'approve' && adjustment.status !== 'pending') {
      throw new ApiError('VALIDATION_ERROR', 'Can only approve pending adjustments', 400)
    }
    if (action === 'reject' && adjustment.status !== 'pending') {
      throw new ApiError('VALIDATION_ERROR', 'Can only reject pending adjustments', 400)
    }
    if (action === 'complete' && adjustment.status !== 'approved') {
      throw new ApiError('VALIDATION_ERROR', 'Can only complete approved adjustments', 400)
    }

    let updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (action === 'approve') {
      updateData.status = 'approved'
      updateData.approved_by = performedBy || null
      updateData.approved_at = new Date().toISOString()
    } else if (action === 'reject') {
      updateData.status = 'rejected'
    } else if (action === 'complete') {
      // Get user's current balance
      const balance = await getUserTokenBalance(adjustment.user_id, adminClient)
      
      // Apply the token adjustment
      const result = await adminAdjustTokens({
        userId: adjustment.user_id,
        tokensChange: adjustment.amount,
        reason: adjustment.reason,
        performedBy: performedBy || 'system',
      })

      updateData.status = 'completed'
      updateData.completed_at = new Date().toISOString()
      updateData.balance_before = balance.totalTokens
      updateData.balance_after = result.newBalance
      updateData.transaction_id = result.transactionId
    }

    // Update adjustment
    const { data: updated, error: updateError } = await adminClient
      .from(TABLES.TOKEN_ADJUSTMENTS)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw new ApiError('SERVER_ERROR', 'Failed to update adjustment', 500, updateError)
    }

    return NextResponse.json({
      success: true,
      data: { adjustment: updated },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// Error handler
function handleApiError(error: unknown) {
  console.error('[API /tokens/adjustments]', error)

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
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    },
  }, { status: 500 })
}
