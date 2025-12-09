/**
 * Stripe Webhook Handler
 * POST /api/payments/webhook - Handle Stripe webhook events
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { 
  handlePaymentSucceeded,
  handlePaymentFailed
} from '@/services/payment.service'

// Stripe webhook secret from environment
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Type for Stripe event (simplified, actual types come from stripe package)
interface StripeEvent {
  id: string
  type: string
  data: {
    object: {
      id: string
      last_payment_error?: {
        message?: string
      }
    }
  }
}

/**
 * POST /api/payments/webhook - Handle Stripe webhook events
 * This endpoint is called by Stripe, not by our app
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    if (!webhookSecret) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    // Dynamically import and verify webhook signature
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe')
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-11-17.clover',
    })

    let event: StripeEvent

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('[Webhook] Signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntentId = event.data.object.id
        await handlePaymentSucceeded(paymentIntentId)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntentId = event.data.object.id
        const failureReason = event.data.object.last_payment_error?.message
        await handlePaymentFailed(paymentIntentId, failureReason)
        break
      }

      case 'payment_intent.canceled': {
        const paymentIntentId = event.data.object.id
        await handlePaymentFailed(paymentIntentId, 'Payment canceled')
        break
      }

      case 'charge.refunded': {
        console.log('[Webhook] Charge refunded:', event.data.object.id)
        // Refund handling is done in createRefund service
        break
      }

      default:
        console.log('[Webhook] Unhandled event type:', event.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
