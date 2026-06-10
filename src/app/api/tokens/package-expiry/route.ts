// GET /api/tokens/package-expiry
// Admin: users/packages with tokens expiring within 7 days or already expired (SGT calendar days)

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import {
  sgtDaysUntilExpiry,
  isExpiredBySgtCalendar,
} from '@/lib/reports-utils'
import { getPackageExpiryBounds, getPackageExpiryCounts } from '@/lib/token-expiry-utils'

export type PackageExpiryFilter = 'expiring_soon' | 'expired'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = (searchParams.get('filter') || 'expiring_soon') as PackageExpiryFilter
    const search = searchParams.get('search')?.trim() || undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(5, parseInt(searchParams.get('pageSize') || '10', 10) || 10))

    if (filter !== 'expiring_soon' && filter !== 'expired') {
      throw new ApiError('VALIDATION_ERROR', 'Invalid filter. Use expiring_soon or expired.', 400)
    }

    const adminClient = getSupabaseAdminClient()
    const now = new Date()
    const { startOfTodaySgt, startOfWindowEndSgt } = getPackageExpiryBounds(now)

    let userIdFilter: string[] | null = null
    if (search) {
      const term = `%${search}%`
      const { data: profiles } = await adminClient
        .from(TABLES.USER_PROFILES)
        .select('id')
        .or(`name.ilike.${term},email.ilike.${term}`)

      userIdFilter = (profiles || []).map((p: { id: string }) => p.id)
      if (userIdFilter.length === 0) {
        const counts = await getPackageExpiryCounts(now)
        return NextResponse.json({
          success: true,
          data: {
            items: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
            counts,
          },
        })
      }
    }

    let query = adminClient
      .from(TABLES.USER_PACKAGES)
      .select(
        `
        id,
        user_id,
        tokens_remaining,
        tokens_held,
        expires_at,
        status,
        purchased_at,
        package:packages(id, name, token_count)
      `,
        { count: 'exact' }
      )

    if (filter === 'expiring_soon') {
      query = query
        .eq('status', 'active')
        .gte('expires_at', startOfTodaySgt)
        .lt('expires_at', startOfWindowEndSgt)
        .gt('tokens_remaining', 0)
        .order('expires_at', { ascending: true })
    } else {
      query = query
        .or(`status.eq.expired,and(status.eq.active,expires_at.lt.${startOfTodaySgt})`)
        .order('expires_at', { ascending: false })
    }

    if (userIdFilter) {
      query = query.in('user_id', userIdFilter)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data: packages, error, count } = await query

    if (error) {
      throw new ApiError('SERVER_ERROR', 'Failed to fetch package expiry data', 500, error)
    }

    const userIds = [...new Set((packages || []).map((p: { user_id: string }) => p.user_id))]
    let userProfiles: Record<string, { name: string | null; email: string | null; avatar_url: string | null }> = {}

    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from(TABLES.USER_PROFILES)
        .select('id, name, email, avatar_url')
        .in('id', userIds)

      if (profiles) {
        userProfiles = profiles.reduce(
          (
            acc: Record<string, { name: string | null; email: string | null; avatar_url: string | null }>,
            p: { id: string; name: string | null; email: string | null; avatar_url: string | null }
          ) => {
            acc[p.id] = { name: p.name, email: p.email, avatar_url: p.avatar_url }
            return acc
          },
          {}
        )
      }
    }

    const items = (packages || []).map(
      (row: {
        id: string
        user_id: string
        tokens_remaining: number
        tokens_held: number
        expires_at: string
        status: string
        purchased_at: string
        package: { id: string; name: string; token_count: number } | { id: string; name: string; token_count: number }[] | null
      }) => {
        const profile = userProfiles[row.user_id]
        const pkg = Array.isArray(row.package) ? row.package[0] : row.package
        const daysUntilExpiry = sgtDaysUntilExpiry(row.expires_at, now)
        const daysSinceExpiry = daysUntilExpiry < 0 ? Math.abs(daysUntilExpiry) : 0
        const isProcessed = row.status === 'expired'
        const isPastExpiryDate = isExpiredBySgtCalendar(row.expires_at, now)

        return {
          id: row.id,
          userId: row.user_id,
          userName: profile?.name || 'Unknown User',
          userEmail: profile?.email || '',
          userAvatar: profile?.avatar_url ?? null,
          packageId: pkg?.id ?? null,
          packageName: pkg?.name || 'Unknown package',
          tokensRemaining: row.tokens_remaining,
          tokensHeld: row.tokens_held,
          availableTokens: row.tokens_remaining - row.tokens_held,
          expiresAt: row.expires_at,
          purchasedAt: row.purchased_at,
          status: row.status,
          daysUntilExpiry,
          daysSinceExpiry,
          isPastExpiry: isPastExpiryDate,
          isProcessed,
          stillHasTokens: row.tokens_remaining > 0,
        }
      }
    )

    const counts = await getPackageExpiryCounts(now)
    const total = count ?? 0

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        counts,
      },
    })
  } catch (error) {
    console.error('[API /tokens/package-expiry]', error)

    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: error.code, message: error.message, details: error.details },
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}
