/**
 * Payment API Routes
 * POST /api/payments - Create HitPay payment request
 * GET /api/payments - Get payment history
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuthentication, AuthenticatedUser } from '@/middleware/rbac'
import { 
  createPayment,
  getUserPayments
} from '@/services/payment.service'
import { createAuditLog } from '@/services/rbac.service'
import { CreatePaymentRequestSchema } from '@/api/schemas/payment'
import { z } from 'zod'

// Query params schema for payment history
const PaymentHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'expired']).optional()
})

/**
 * GET /api/payments - Get current user's payment history
 */
async function handleGetPayments(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const queryResult = PaymentHistoryQuerySchema.safeParse({
      page: url.searchParams.get('page'),
      limit: url.searchParams.get('limit'),
      status: url.searchParams.get('status')
    })

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid query parameters', details: queryResult.error.issues },
        { status: 400 }
      )
    }

    const { page, limit, status } = queryResult.data

    const result = await getUserPayments(context.user.id, {
      page,
      pageSize: limit,
      status
    })

    return NextResponse.json({
      data: result.payments,
      pagination: {
        page,
        limit,
        total: result.meta.total,
        totalPages: Math.ceil(result.meta.total / limit)
      }
    })
  } catch (error) {
    console.error('Error getting payment history:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get payment history' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payments - Create HitPay payment request
 * Returns a payment URL to redirect the user to complete payment
 */
async function handleCreatePayment(
  request: NextRequest,
  context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const body = await request.json()
    const parseResult = CreatePaymentRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const result = await createPayment(context.user.id, {
      packageId: parseResult.data.packageId,
      paymentMethods: parseResult.data.paymentMethods,
      redirectUrl: parseResult.data.redirectUrl
    })

    // Log the action
    await createAuditLog({
      userId: context.user.id,
      action: 'create_payment',
      resourceType: 'payments',
      resourceId: result.paymentRequestId,
      newValues: {
        provider: 'hitpay',
        amount_cents: result.amountCents,
        currency: result.currency
      }
    })

    return NextResponse.json({
      paymentRequestId: result.paymentRequestId,
      paymentUrl: result.paymentUrl,
      amountCents: result.amountCents,
      currency: result.currency,
      expiresAt: result.expiresAt
    })
  } catch (error) {
    console.error('Error creating payment:', error)
    const message = error instanceof Error ? error.message : 'Failed to create payment'
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 }
    )
  }
}

// Export handlers
export const GET = withAuthentication(handleGetPayments)
export const POST = withAuthentication(handleCreatePayment)
