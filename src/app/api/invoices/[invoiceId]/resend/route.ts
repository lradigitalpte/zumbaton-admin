/**
 * Resend Invoice API Route
 * POST /api/invoices/[invoiceId]/resend - Re-send an existing invoice's email
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { resendInvoice } from '@/services/payment.service'
import { createAuditLog } from '@/services/rbac.service'
import { isApiError } from '@/lib/api-error'

type RouteParams = { invoiceId: string }

async function handleResendInvoice(
  request: NextRequest,
  context: { params: Promise<RouteParams>; user: AuthenticatedUser }
): Promise<NextResponse> {
  try {
    const { invoiceId } = await context.params

    await resendInvoice(invoiceId)

    await createAuditLog({
      userId: context.user.id,
      action: 'invoice.resend',
      resourceType: 'invoice',
      resourceId: invoiceId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resending invoice:', error)

    if (isApiError(error)) {
      return NextResponse.json(
        { error: error.code, message: error.message, details: error.details },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to resend invoice' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleResendInvoice, { requiredRole: 'admin' })
