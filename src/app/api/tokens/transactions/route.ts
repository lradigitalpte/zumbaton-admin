// Tokens Transactions API Route
// Gets token transaction history - supports both admin (all) and user-specific queries

import { NextRequest, NextResponse } from 'next/server'
import { getTokenTransactions } from '@/services/token.service'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'

// GET /api/tokens/transactions - Get token transactions
// If userId provided: get transactions for that user
// If no userId: get all transactions (admin view)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('userId')
    const transactionType = searchParams.get('type') || searchParams.get('transactionType') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const search = searchParams.get('search') || undefined
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 20

    // If userId provided, use existing service (user-specific)
    if (userId) {
      UuidSchema.parse(userId)
      const result = await getTokenTransactions({
        userId,
        transactionType,
        startDate,
        endDate,
        page,
        pageSize,
      })
      return NextResponse.json({
        success: true,
        data: result,
      })
    }

    // Admin view: get all transactions with user info
    const adminClient = getSupabaseAdminClient()
    
    let query = adminClient
      .from(TABLES.TOKEN_TRANSACTIONS)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filter by transaction type
    if (transactionType && transactionType !== 'all') {
      query = query.eq('transaction_type', transactionType)
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

    const { data: transactions, error, count } = await query

    if (error) {
      throw new ApiError('SERVER_ERROR', 'Failed to fetch transactions', 500, error)
    }

    // Get unique user IDs to fetch user profiles
    const userIds = [...new Set((transactions || []).map((t: { user_id: string }) => t.user_id))]
    
    // Fetch user profiles for all users in transactions
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

    // Transform and add user data
    let result = (transactions || []).map((t: {
      id: string
      user_id: string
      user_package_id: string | null
      booking_id: string | null
      transaction_type: string
      tokens_change: number
      tokens_before: number
      tokens_after: number
      description: string | null
      performed_by: string | null
      created_at: string
    }) => {
      const profile = userProfiles[t.user_id] || {}
      return {
        id: t.id,
        userId: t.user_id,
        userName: profile.name || 'Unknown User',
        userEmail: profile.email || '',
        userPackageId: t.user_package_id,
        bookingId: t.booking_id,
        type: t.transaction_type,
        amount: Math.abs(t.tokens_change),
        balance: t.tokens_after,
        description: t.description,
        performedBy: t.performed_by,
        createdAt: t.created_at,
        reference: t.booking_id || t.user_package_id || null,
      }
    })

    // Client-side search filter (for name/email)
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((t: { userName: string; userEmail: string; description: string | null }) => 
        t.userName.toLowerCase().includes(searchLower) ||
        t.userEmail.toLowerCase().includes(searchLower) ||
        (t.description && t.description.toLowerCase().includes(searchLower))
      )
    }

    // Calculate stats from all transactions (separate query for full stats)
    const { data: statsData } = await adminClient
      .from(TABLES.TOKEN_TRANSACTIONS)
      .select('transaction_type, tokens_change, created_at')

    const stats = {
      totalPurchased: 0,
      totalConsumed: 0,
      totalExpired: 0,
      totalAdjusted: 0,
      totalReleased: 0,
      todayTransactions: 0,
    }

    const today = new Date().toISOString().split('T')[0]
    
    if (statsData) {
      for (const t of statsData) {
        const amount = Math.abs(t.tokens_change)
        
        if (t.transaction_type === 'purchase') {
          stats.totalPurchased += amount
        } else if (t.transaction_type.includes('consume')) {
          stats.totalConsumed += amount
        } else if (t.transaction_type === 'expire') {
          stats.totalExpired += amount
        } else if (t.transaction_type === 'admin-adjust') {
          stats.totalAdjusted += t.tokens_change // preserve sign for adjustments
        } else if (t.transaction_type === 'booking-release' || t.transaction_type === 'refund') {
          stats.totalReleased += amount
        }

        if (t.created_at.startsWith(today)) {
          stats.todayTransactions++
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        transactions: result,
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
  console.error('[API /tokens/transactions]', error)

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

  // Zod validation error
  if (error && typeof error === 'object' && 'errors' in error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: (error as { errors: unknown[] }).errors,
      },
    }, { status: 400 })
  }

  return NextResponse.json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  }, { status: 500 })
}
