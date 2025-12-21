/**
 * Backfill Purchase Transactions API
 * POST /api/tokens/backfill-purchases - Create missing purchase transactions for existing user_packages
 * 
 * This endpoint finds all user_packages that don't have a corresponding purchase transaction
 * and creates the missing token_transactions records.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()

    // Find all user_packages that don't have a purchase transaction
    const { data: userPackages, error: packagesError } = await supabase
      .from(TABLES.USER_PACKAGES)
      .select(`
        id,
        user_id,
        package_id,
        tokens_remaining,
        purchased_at,
        packages (
          id,
          name,
          token_count
        )
      `)
      .eq('status', 'active')
      .order('purchased_at', { ascending: false })

    if (packagesError) {
      throw new ApiError('SERVER_ERROR', 'Failed to fetch user packages', 500, packagesError)
    }

    if (!userPackages || userPackages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No user packages found',
        created: 0,
      })
    }

    // Check which ones already have purchase transactions
    const { data: existingTransactions, error: txError } = await supabase
      .from(TABLES.TOKEN_TRANSACTIONS)
      .select('user_package_id')
      .eq('transaction_type', 'purchase')

    if (txError) {
      throw new ApiError('SERVER_ERROR', 'Failed to fetch existing transactions', 500, txError)
    }

    const existingPackageIds = new Set(
      (existingTransactions || []).map((t: { user_package_id: string | null }) => t.user_package_id).filter(Boolean)
    )

    // Filter out packages that already have purchase transactions
    const packagesNeedingTransactions = (userPackages || []).filter(
      (up: { id: string; packages: { token_count: number } | { token_count: number }[] | null }) => {
        return !existingPackageIds.has(up.id)
      }
    )

    if (packagesNeedingTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All user packages already have purchase transactions',
        created: 0,
      })
    }

    // Create purchase transactions for missing ones
    const transactionsToCreate = packagesNeedingTransactions.map((up: {
      id: string
      user_id: string
      package_id: string | null
      tokens_remaining: number
      purchased_at: string
      packages: { name?: string; token_count?: number } | { name?: string; token_count?: number }[] | null
    }) => {
      const pkg = Array.isArray(up.packages) ? up.packages[0] : up.packages
      const tokenCount = pkg?.token_count || up.tokens_remaining || 0
      const packageName = pkg?.name || 'package'

      return {
        user_id: up.user_id,
        user_package_id: up.id,
        transaction_type: 'purchase',
        tokens_change: tokenCount,
        tokens_before: 0,
        tokens_after: tokenCount,
        description: `Purchased ${packageName}`,
        created_at: up.purchased_at || new Date().toISOString(),
      }
    })

    // Insert all missing transactions
    const { data: createdTransactions, error: insertError } = await supabase
      .from(TABLES.TOKEN_TRANSACTIONS)
      .insert(transactionsToCreate)
      .select()

    if (insertError) {
      throw new ApiError('SERVER_ERROR', 'Failed to create purchase transactions', 500, insertError)
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdTransactions?.length || 0} purchase transactions`,
      created: createdTransactions?.length || 0,
      total: packagesNeedingTransactions.length,
    })
  } catch (error) {
    console.error('[Backfill Purchases API] Error:', error)
    
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    )
  }
}
