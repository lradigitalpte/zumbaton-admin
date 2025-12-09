/**
 * Token Adjustment API Route
 * POST /api/tokens/adjust - Admin adjust user tokens manually
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { adminAdjustTokens } from '@/services/token.service'
import { AdminTokenAdjustmentRequestSchema } from '@/api/schemas/user-package'
import { createAuditLog } from '@/services/rbac.service'
import { ApiError, isApiError } from '@/lib/api-error'

async function handleAdjustTokens(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const body = await request.json()

    // Validate request body
    const parseResult = AdminTokenAdjustmentRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const { userId, tokensChange, reason, userPackageId } = parseResult.data

    // Adjust tokens
    const result = await adminAdjustTokens({
      userId,
      userPackageId,
      tokensChange,
      reason,
      performedBy: context.user.id,
    })

    // Log the action
    await createAuditLog({
      userId: context.user.id,
      action: 'adjust_tokens',
      resourceType: 'tokens',
      resourceId: userId,
      newValues: {
        tokensChange,
        newBalance: result.newBalance,
        reason,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        userId: result.userPackageId ? undefined : userId, // userId if adjustment package created
        tokensChange: result.tokensChange,
        newBalance: result.newBalance,
        transactionId: result.transactionId,
        message: `Tokens ${tokensChange >= 0 ? 'added' : 'removed'} successfully`,
      },
    })
  } catch (error) {
    console.error('Error adjusting tokens:', error)
    
    if (isApiError(error)) {
      return NextResponse.json(
        { error: error.code, message: error.message, details: error.details },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to adjust tokens' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleAdjustTokens, { requiredPermission: { resource: 'tokens', action: 'adjust' } })

