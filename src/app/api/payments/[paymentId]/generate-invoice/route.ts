/**
 * Generate Invoice API Route
 * POST /api/payments/[paymentId]/generate-invoice - Backfill an invoice for
 * an already-successful payment that never got one.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { generateInvoiceForPayment } from '@/services/payment.service'
import { isApiError } from '@/lib/api-error'

type RouteParams = { paymentId: string }

async function handleGenerateInvoice(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { paymentId } = await context.params

    const invoice = await generateInvoiceForPayment(paymentId)

    return NextResponse.json({ data: invoice })
  } catch (error) {
    console.error('Error generating invoice:', error)

    if (isApiError(error)) {
      return NextResponse.json(
        { error: error.code, message: error.message, details: error.details },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to generate invoice' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleGenerateInvoice, { requiredRole: 'admin' })
