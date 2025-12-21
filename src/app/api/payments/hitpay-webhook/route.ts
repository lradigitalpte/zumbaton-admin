/**
 * HitPay Webhook Handler
 * POST /api/payments/hitpay-webhook - Handle HitPay webhook events
 *
 * HitPay sends webhooks as application/x-www-form-urlencoded data
 * Webhook signature is verified using HMAC-SHA256
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyHitPayWebhook, amountToCents } from '@/services/hitpay.service'
import {
  handleHitPayPaymentSucceeded,
  handleHitPayPaymentFailed,
} from '@/services/payment.service'

/**
 * POST /api/payments/hitpay-webhook - Handle HitPay webhook events
 * This endpoint is called by HitPay, not by our app
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // HitPay sends data as form-urlencoded
    const formData = await request.formData()

    // Convert FormData to object
    const payload: Record<string, string | null> = {}
    formData.forEach((value, key) => {
      payload[key] = value?.toString() || null
    })

    console.log('[HitPay Webhook] Received payload:', {
      payment_id: payload.payment_id,
      payment_request_id: payload.payment_request_id,
      status: payload.status,
      amount: payload.amount,
      currency: payload.currency,
    })

    // Verify HMAC signature
    const providedHmac = payload.hmac
    if (!providedHmac) {
      console.error('[HitPay Webhook] Missing HMAC signature')
      return NextResponse.json(
        { error: 'Missing HMAC signature' },
        { status: 400 }
      )
    }

    const isValid = verifyHitPayWebhook(payload, providedHmac)
    if (!isValid) {
      console.error('[HitPay Webhook] Invalid HMAC signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Extract payment details
    const {
      payment_id,
      payment_request_id,
      status,
      amount,
      reference_number,
    } = payload

    if (!payment_id || !payment_request_id || !status) {
      console.error('[HitPay Webhook] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Handle different payment statuses
    switch (status) {
      case 'completed': {
        console.log('[HitPay Webhook] Payment completed:', payment_id)
        await handleHitPayPaymentSucceeded(
          payment_request_id,
          payment_id,
          amountToCents(parseFloat(amount || '0'))
        )
        break
      }

      case 'failed': {
        console.log('[HitPay Webhook] Payment failed:', payment_id)
        await handleHitPayPaymentFailed(payment_request_id, 'Payment failed')
        break
      }

      case 'pending': {
        console.log('[HitPay Webhook] Payment pending:', payment_id)
        // Payment is still pending, no action needed
        break
      }

      case 'refunded': {
        console.log('[HitPay Webhook] Payment refunded:', payment_id)
        // Handle refund if needed (usually handled separately)
        break
      }

      default:
        console.log('[HitPay Webhook] Unknown status:', status)
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[HitPay Webhook] Error processing webhook:', error)
    // Return 200 anyway to prevent HitPay from retrying
    // Log the error for investigation
    return NextResponse.json({ received: true, error: 'Processing error' })
  }
}

// HitPay may also send GET requests to verify the endpoint
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    message: 'HitPay webhook endpoint is active',
  })
}
