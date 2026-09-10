/**
 * Payment Invoice Lookup API Route
 * GET /api/payments/[paymentId]/invoice - Find the invoice for a payment
 * (used by Trial Bookings, where guests have no userId to look up by)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { getInvoiceByPaymentId } from '@/services/payment.service'
import { isApiError } from '@/lib/api-error'

type RouteParams = { paymentId: string }

async function handleGetInvoiceByPayment(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { paymentId } = await context.params

    const invoice = await getInvoiceByPaymentId(paymentId)

    if (!invoice) {
      return NextResponse.json(
        { error: 'NOT_FOUND_ERROR', message: 'No invoice found for this payment' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: invoice })
  } catch (error) {
    console.error('Error getting invoice by payment:', error)

    if (isApiError(error)) {
      return NextResponse.json(
        { error: error.code, message: error.message, details: error.details },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get invoice' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetInvoiceByPayment, { requiredRole: 'admin' })
