/**
 * User Payments Missing Invoice API Route
 * GET /api/users/[userId]/payments/missing-invoices - List succeeded payments with no invoice yet (backfill candidates)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withSelfOrAdmin, AuthenticatedUser } from '@/middleware/rbac'
import { getPaymentsMissingInvoices } from '@/services/payment.service'
import { isApiError } from '@/lib/api-error'

type RouteParams = { userId: string }

async function handleGetMissingInvoices(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params
    const targetUserId = userId === 'me' ? context.user.id : userId

    const payments = await getPaymentsMissingInvoices(targetUserId)

    return NextResponse.json({ data: { payments } })
  } catch (error) {
    console.error('Error getting payments missing invoices:', error)

    if (isApiError(error)) {
      return NextResponse.json(
        { error: error.code, message: error.message, details: error.details },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get payments missing invoices' },
      { status: 500 }
    )
  }
}

export const GET = withSelfOrAdmin(handleGetMissingInvoices)
