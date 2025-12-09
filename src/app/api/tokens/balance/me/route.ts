/**
 * Token Balance API Route (Authenticated)
 * GET /api/tokens/balance/me - Get current user's token balance
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { getUserTokenBalance } from '@/services/token.service'
import { getSupabaseAdminClient } from '@/lib/supabase'

/**
 * GET /api/tokens/balance/me - Get current user's token balance
 */
async function handleGetBalance(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    // Use admin client to bypass RLS and ensure we can access the user's packages
    const adminClient = getSupabaseAdminClient()
    
    // Debug: Check all user packages (not just active ones)
    const { data: allPackages, error: debugError } = await adminClient
      .from('user_packages')
      .select('*')
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
    
    if (debugError) {
      console.error('[Token Balance] Error fetching packages for debug:', debugError)
    } else {
      console.log(`[Token Balance] User ${context.user.id} has ${allPackages?.length || 0} total packages`)
      if (allPackages && allPackages.length > 0) {
        console.log('[Token Balance] Package details:', allPackages.map(p => ({
          id: p.id,
          status: p.status,
          tokens_remaining: p.tokens_remaining,
          tokens_held: p.tokens_held,
          expires_at: p.expires_at,
          is_expired: new Date(p.expires_at) <= new Date()
        })))
      }
    }
    
    const balance = await getUserTokenBalance(context.user.id, adminClient)

    // Calculate pending tokens (tokens that are held but not yet consumed)
    const pending = balance.heldTokens

    console.log(`[Token Balance] Balance for user ${context.user.id}:`, {
      total: balance.totalTokens,
      available: balance.availableTokens,
      held: balance.heldTokens,
      activePackages: balance.activePackages
    })

    return NextResponse.json({
      success: true,
      data: {
        available: balance.availableTokens,
        pending: pending,
        total: balance.totalTokens,
      },
    })
  } catch (error) {
    console.error('Error getting token balance:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to get token balance',
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withAuthentication(handleGetBalance)

