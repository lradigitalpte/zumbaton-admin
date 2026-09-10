/**
 * User Invoices API Route
 * GET /api/users/[userId]/invoices - List a user's invoices
 */

import { NextRequest, NextResponse } from 'next/server'
import { withSelfOrAdmin, AuthenticatedUser } from '@/middleware/rbac'
import { getUserInvoices } from '@/services/payment.service'
import { InvoiceListQuerySchema } from '@/api/schemas/payment'
import { isApiError } from '@/lib/api-error'

type RouteParams = { userId: string }

async function handleGetUserInvoices(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params
    const targetUserId = userId === 'me' ? context.user.id : userId

    const { searchParams } = new URL(request.url)
    const query = InvoiceListQuerySchema.parse({
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
      status: searchParams.get('status') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    })

    const result = await getUserInvoices(targetUserId, query)

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Error getting user invoices:', error)

    if (isApiError(error)) {
      return NextResponse.json(
        { error: error.code, message: error.message, details: error.details },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get invoices' },
      { status: 500 }
    )
  }
}

export const GET = withSelfOrAdmin(handleGetUserInvoices)
