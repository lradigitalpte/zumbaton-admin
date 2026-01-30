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

    // Get unique user IDs to fetch user profiles (filter out nulls)
    const userIds = [...new Set((transactions || []).map((t: { user_id: string | null }) => t.user_id).filter(Boolean) as string[])]
    
    // Fetch user profiles for all users in transactions
    let userProfiles: Record<string, { name: string | null; email: string | null; avatar_url: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from(TABLES.USER_PROFILES)
        .select('id, name, email, avatar_url')
        .in('id', userIds)

      if (profiles) {
        userProfiles = profiles.reduce((acc: Record<string, { name: string | null; email: string | null; avatar_url: string | null }>, p: { id: string; name: string | null; email: string | null; avatar_url: string | null }) => {
          acc[p.id] = { name: p.name, email: p.email, avatar_url: p.avatar_url }
          return acc
        }, {})
      }
    }

    // Get booking IDs for transactions without user_id (trial bookings)
    const bookingIds = [...new Set((transactions || [])
      .filter((t: { user_id: string | null; booking_id: string | null }) => !t.user_id && t.booking_id)
      .map((t: { booking_id: string | null }) => t.booking_id)
      .filter(Boolean) as string[])]
    
    // Fetch guest names from bookings
    const guestBookingsMap: Record<string, { guest_name: string | null; guest_email: string | null }> = {}
    if (bookingIds.length > 0) {
      const { data: bookings } = await adminClient
        .from(TABLES.BOOKINGS)
        .select('id, guest_name, guest_email')
        .in('id', bookingIds)
      
      if (bookings) {
        for (const b of bookings) {
          guestBookingsMap[b.id] = { guest_name: b.guest_name, guest_email: b.guest_email }
        }
      }
    }

    // Get payment IDs for transactions linked via user_package_id (trial purchases)
    const userPackageIds = [...new Set((transactions || [])
      .filter((t: { user_id: string | null; user_package_id: string | null }) => !t.user_id && t.user_package_id)
      .map((t: { user_package_id: string | null }) => t.user_package_id)
      .filter(Boolean) as string[])]
    
    // Fetch guest info from payments linked to user_packages
    // Map: user_package_id -> guest_name
    const userPackageToGuestMap: Record<string, string> = {}
    if (userPackageIds.length > 0) {
      const { data: userPackages } = await adminClient
        .from(TABLES.USER_PACKAGES)
        .select('id, payment_id')
        .in('id', userPackageIds)
      
      const paymentIds = (userPackages || [])
        .map((up: { payment_id: string | null }) => up.payment_id)
        .filter(Boolean) as string[]
      
      if (paymentIds.length > 0) {
        // Get bookings linked to these payments (for trial bookings)
        const { data: paymentBookings } = await adminClient
          .from(TABLES.BOOKINGS)
          .select('payment_id, guest_name')
          .in('payment_id', paymentIds)
          .eq('is_trial_booking', true)
        
        const paymentToGuestMap: Record<string, string> = {}
        if (paymentBookings) {
          for (const pb of paymentBookings) {
            if (pb.payment_id && pb.guest_name) {
              paymentToGuestMap[pb.payment_id] = pb.guest_name
            }
          }
        }
        
        // Also check payment metadata for guest_name
        const { data: payments } = await adminClient
          .from(TABLES.PAYMENTS)
          .select('id, metadata')
          .in('id', paymentIds)
        
        if (payments) {
          for (const p of payments) {
            const metadata = p.metadata as { guest_name?: string } | null
            if (p.id && metadata?.guest_name && !paymentToGuestMap[p.id]) {
              paymentToGuestMap[p.id] = metadata.guest_name
            }
          }
        }
        
        // Map user_package_id -> payment_id -> guest_name
        for (const up of userPackages || []) {
          if (up.payment_id && paymentToGuestMap[up.payment_id]) {
            userPackageToGuestMap[up.id] = paymentToGuestMap[up.payment_id]
          }
        }
      }
    }

    // Transform and add user data
    let result = (transactions || []).map((t: {
      id: string
      user_id: string | null
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
      // Get user name: from user profile, or guest booking, or guest payment
      let userName = 'Unknown User'
      let userEmail = ''
      
      // First, try to get from user profile if user_id exists and user exists
      if (t.user_id && userProfiles[t.user_id]) {
        const profile = userProfiles[t.user_id]
        userName = profile.name || 'Unknown User'
        userEmail = profile.email || ''
      }
      // If no user profile found, check guest bookings
      else if (t.booking_id && guestBookingsMap[t.booking_id]?.guest_name) {
        userName = guestBookingsMap[t.booking_id].guest_name || 'Unknown User'
        userEmail = guestBookingsMap[t.booking_id].guest_email || ''
      }
      // If no booking found, check user package -> payment -> guest chain
      else if (t.user_package_id && userPackageToGuestMap[t.user_package_id]) {
        userName = userPackageToGuestMap[t.user_package_id]
      }
      
      type ProfileInfo = { name?: string | null; email?: string | null; avatar_url?: string | null }
      const profile: ProfileInfo = t.user_id ? (userProfiles[t.user_id] ?? {}) : {}
      
      return {
        id: t.id,
        userId: t.user_id,
        userName,
        userEmail: userEmail || (profile.email ?? ''),
        userAvatar: profile.avatar_url ?? null,
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
