import { getSupabaseAdminClient } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import { createAuditLog, requirePermission } from './rbac.service'
import { purchasePackage } from './user-package.service'
import { sendPaymentSuccessful } from './notification.service'
import {
  createPaymentRequest as hitpayCreatePaymentRequest,
  hitpayCreateRefund,
  getWebhookUrl,
  getRedirectUrl,
  centsToAmount,
  isHitPayConfigured,
} from './hitpay.service'
import type {
  Payment,
  Refund,
  Invoice,
  PaymentStatus,
  CreatePaymentRequest,
  CreatePaymentResponse,
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  CreateRefundRequest,
  PaymentListQuery,
  PaymentListResponse,
  InvoiceListQuery,
  InvoiceListResponse,
  PaymentMethod,
  PaymentMethodListResponse,
  AdminPaymentListQuery,
  HitPayPaymentMethod,
} from '@/api/schemas'

// =====================================================
// APP BASE URL
// =====================================================

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  )
}

// =====================================================
// STRIPE CLIENT (legacy support - lazy loaded)
// =====================================================

let stripeClient: import('stripe').default | null = null

async function getStripe(): Promise<import('stripe').default> {
  if (!stripeClient) {
    const Stripe = (await import('stripe')).default
    const secretKey = process.env.STRIPE_SECRET_KEY

    if (!secretKey) {
      throw new ApiError('SERVER_ERROR', 'Stripe is not configured', 500)
    }

    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-11-17.clover',
    })
  }
  return stripeClient
}

// =====================================================
// HELPER: Convert DB row to Payment
// =====================================================

function toPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    packageId: row.package_id as string | null,
    amountCents: row.amount_cents as number,
    currency: row.currency as string,
    status: row.status as PaymentStatus,
    paymentMethod: row.payment_method as string | null,
    provider: (row.provider as 'hitpay' | 'stripe' | 'manual') || 'hitpay',
    // HitPay fields
    hitpayPaymentRequestId: row.hitpay_payment_request_id as string | null,
    hitpayPaymentId: row.hitpay_payment_id as string | null,
    hitpayPaymentUrl: row.hitpay_payment_url as string | null,
    // Stripe fields (legacy)
    stripePaymentIntentId: row.stripe_payment_intent_id as string | null,
    stripeCustomerId: row.stripe_customer_id as string | null,
    stripeChargeId: row.stripe_charge_id as string | null,
    // Common fields
    receiptUrl: row.receipt_url as string | null,
    failureReason: row.failure_reason as string | null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function toInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    paymentId: row.payment_id as string | null,
    invoiceNumber: row.invoice_number as string,
    amountCents: row.amount_cents as number,
    taxCents: row.tax_cents as number,
    totalCents: row.total_cents as number,
    currency: row.currency as string,
    status: row.status as 'draft' | 'issued' | 'paid' | 'void' | 'overdue',
    pdfUrl: row.pdf_url as string | null,
    issuedAt: row.issued_at as string | null,
    dueAt: row.due_at as string | null,
    paidAt: row.paid_at as string | null,
    createdAt: row.created_at as string,
  }
}

// =====================================================
// GET OR CREATE STRIPE CUSTOMER
// =====================================================

async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  // Check if customer already exists
  const { data: existing } = await getSupabaseAdminClient()
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id
  }

  // Get user info
  const { data: user } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('email, name')
    .eq('id', userId)
    .single()

  if (!user) {
    throw new ApiError('NOT_FOUND_ERROR', 'User not found', 404)
  }

  // Create Stripe customer
  const stripe = await getStripe()
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      user_id: userId,
    },
  })

  // Save to database
  await getSupabaseAdminClient()
    .from('stripe_customers')
    .insert({
      user_id: userId,
      stripe_customer_id: customer.id,
    })

  return customer.id
}

// =====================================================
// CREATE PAYMENT (HitPay - Primary)
// =====================================================

export async function createPayment(
  userId: string,
  request: CreatePaymentRequest
): Promise<CreatePaymentResponse> {
  const { packageId, paymentMethods } = request

  // Verify HitPay is configured
  if (!isHitPayConfigured()) {
    throw new ApiError('SERVER_ERROR', 'Payment gateway is not configured', 500)
  }

  // Get package details
  const { data: pkg } = await getSupabaseAdminClient()
    .from('packages')
    .select('*')
    .eq('id', packageId)
    .eq('is_active', true)
    .single()

  if (!pkg) {
    throw new ApiError('NOT_FOUND_ERROR', 'Package not found or inactive', 404)
  }

  // Get user details
  const { data: user } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('email, name')
    .eq('id', userId)
    .single()

  if (!user) {
    throw new ApiError('NOT_FOUND_ERROR', 'User not found', 404)
  }

  const baseUrl = getBaseUrl()
  const currency = pkg.currency || 'SGD' // Default to SGD for Singapore

  // Create HitPay payment request
  const hitpayResponse = await hitpayCreatePaymentRequest({
    amount: centsToAmount(pkg.price_cents),
    currency: currency,
    email: user.email,
    name: user.name || 'Customer',
    purpose: `Purchase: ${pkg.name} (${pkg.token_count} tokens)`,
    reference_number: `${userId}-${packageId}-${Date.now()}`,
    redirect_url: getRedirectUrl(baseUrl, 'success'),
    webhook: getWebhookUrl(baseUrl),
    payment_methods: paymentMethods as string[] | undefined,
    send_email: true,
  })

  // Create payment record in database
  const { data: payment, error } = await getSupabaseAdminClient()
    .from('payments')
    .insert({
      user_id: userId,
      package_id: packageId,
      amount_cents: pkg.price_cents,
      currency: currency,
      status: 'pending',
      provider: 'hitpay',
      hitpay_payment_request_id: hitpayResponse.id,
      hitpay_payment_url: hitpayResponse.url,
      metadata: {
        package_name: pkg.name,
        token_count: pkg.token_count,
        hitpay_reference: hitpayResponse.reference_number,
      },
    })
    .select()
    .single()

  if (error) {
    console.error('[Payment] Failed to create payment record:', error)
    throw new ApiError('SERVER_ERROR', 'Failed to create payment', 500)
  }

  return {
    paymentRequestId: hitpayResponse.id,
    paymentUrl: hitpayResponse.url,
    amountCents: pkg.price_cents,
    currency: currency,
    expiresAt: hitpayResponse.expiry_date,
  }
}

// =====================================================
// HANDLE HITPAY WEBHOOK: Payment Succeeded
// =====================================================

export async function handleHitPayPaymentSucceeded(
  paymentRequestId: string,
  hitpayPaymentId: string,
  amountCents: number
): Promise<void> {
  // Get payment record by HitPay payment request ID
  const { data: payment, error: fetchError } = await getSupabaseAdminClient()
    .from('payments')
    .select('*')
    .eq('hitpay_payment_request_id', paymentRequestId)
    .single()

  if (fetchError || !payment) {
    console.error('[HitPay] Payment not found for request:', paymentRequestId)
    return
  }

  const userId = payment.user_id
  const packageId = payment.package_id

  if (!userId || !packageId) {
    console.error('[HitPay] Missing user or package ID in payment:', payment.id)
    return
  }

  // Update payment record
  const { error: updateError } = await getSupabaseAdminClient()
    .from('payments')
    .update({
      status: 'succeeded',
      hitpay_payment_id: hitpayPaymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id)

  if (updateError) {
    console.error('[HitPay] Failed to update payment:', updateError)
    return
  }

  // Create user package with tokens
  await purchasePackage({
    userId,
    packageId,
    paymentId: payment.id,
  })

  // Create invoice
  await createInvoice(userId, payment.id, payment.amount_cents)

  // Get user and package info for notification
  const { data: user } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('name')
    .eq('id', userId)
    .single()

  const { data: pkg } = await getSupabaseAdminClient()
    .from('packages')
    .select('name, token_count')
    .eq('id', packageId)
    .single()

  // Send payment confirmation email
  if (user && pkg) {
    await sendPaymentSuccessful(userId, {
      userName: user.name,
      packageName: pkg.name,
      tokenCount: pkg.token_count,
      amount: (payment.amount_cents / 100).toFixed(2),
    })
  }

  // Audit log
  await createAuditLog({
    userId,
    action: 'payment.succeeded',
    resourceType: 'payments',
    resourceId: payment.id,
    newValues: {
      amount_cents: payment.amount_cents,
      package_id: packageId,
      provider: 'hitpay',
    },
  })

  console.log('[HitPay] Payment succeeded:', payment.id)
}

// =====================================================
// HANDLE HITPAY WEBHOOK: Payment Failed
// =====================================================

export async function handleHitPayPaymentFailed(
  paymentRequestId: string,
  failureReason?: string
): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from('payments')
    .update({
      status: 'failed',
      failure_reason: failureReason || 'Payment failed',
      updated_at: new Date().toISOString(),
    })
    .eq('hitpay_payment_request_id', paymentRequestId)

  if (error) {
    console.error('[HitPay] Failed to update payment status:', error)
  }
}

// =====================================================
// CREATE PAYMENT INTENT (Stripe - Legacy Support)
// =====================================================

export async function createPaymentIntent(
  userId: string,
  request: CreatePaymentIntentRequest
): Promise<CreatePaymentIntentResponse> {
  const { packageId, paymentMethodId } = request

  // Get package details
  const { data: pkg } = await getSupabaseAdminClient()
    .from('packages')
    .select('*')
    .eq('id', packageId)
    .eq('is_active', true)
    .single()

  if (!pkg) {
    throw new ApiError('NOT_FOUND_ERROR', 'Package not found or inactive', 404)
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(userId)

  // Create payment intent
  const stripe = await getStripe()
  
  const paymentIntentData: import('stripe').Stripe.PaymentIntentCreateParams = {
    amount: pkg.price_cents,
    currency: (pkg.currency || 'USD').toLowerCase(),
    customer: customerId,
    metadata: {
      user_id: userId,
      package_id: packageId,
      package_name: pkg.name,
      token_count: String(pkg.token_count),
    },
    automatic_payment_methods: {
      enabled: true,
    },
  }

  if (paymentMethodId) {
    paymentIntentData.payment_method = paymentMethodId
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentData)

  // Create payment record
  await getSupabaseAdminClient()
    .from('payments')
    .insert({
      user_id: userId,
      package_id: packageId,
      amount_cents: pkg.price_cents,
      currency: pkg.currency || 'USD',
      status: 'pending',
      provider: 'stripe',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_customer_id: customerId,
      metadata: {
        package_name: pkg.name,
        token_count: pkg.token_count,
      },
    })

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
    amountCents: pkg.price_cents,
    currency: pkg.currency || 'USD',
  }
}

// =====================================================
// HANDLE WEBHOOK: Payment Succeeded
// =====================================================

export async function handlePaymentSucceeded(
  paymentIntentId: string
): Promise<void> {
  const stripe = await getStripe()
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  const userId = paymentIntent.metadata.user_id
  const packageId = paymentIntent.metadata.package_id

  if (!userId || !packageId) {
    console.error('[Payment] Missing metadata in payment intent:', paymentIntentId)
    return
  }

  // Get charge details for receipt
  let receiptUrl: string | null = null
  let chargeId: string | null = null
  
  if (paymentIntent.latest_charge) {
    const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string)
    receiptUrl = charge.receipt_url
    chargeId = charge.id
  }

  // Update payment record
  const { data: payment, error } = await getSupabaseAdminClient()
    .from('payments')
    .update({
      status: 'succeeded',
      stripe_charge_id: chargeId,
      receipt_url: receiptUrl,
      payment_method: paymentIntent.payment_method_types?.[0] || null,
    })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .select()
    .single()

  if (error) {
    console.error('[Payment] Failed to update payment:', error)
    return
  }

  // Create user package with tokens
  await purchasePackage({
    userId,
    packageId,
    paymentId: payment.id,
  })

  // Create invoice
  await createInvoice(userId, payment.id, payment.amount_cents)

  // Get user and package info for notification
  const { data: user } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('name')
    .eq('id', userId)
    .single()

  const { data: pkg } = await getSupabaseAdminClient()
    .from('packages')
    .select('name, token_count')
    .eq('id', packageId)
    .single()

  // Send payment confirmation email
  if (user && pkg) {
    await sendPaymentSuccessful(userId, {
      userName: user.name,
      packageName: pkg.name,
      tokenCount: pkg.token_count,
      amount: (payment.amount_cents / 100).toFixed(2),
    })
  }

  // Audit log
  await createAuditLog({
    userId,
    action: 'payment.succeeded',
    resourceType: 'payments',
    resourceId: payment.id,
    newValues: {
      amount_cents: payment.amount_cents,
      package_id: packageId,
    },
  })
}

// =====================================================
// HANDLE WEBHOOK: Payment Failed
// =====================================================

export async function handlePaymentFailed(
  paymentIntentId: string,
  failureReason?: string
): Promise<void> {
  await getSupabaseAdminClient()
    .from('payments')
    .update({
      status: 'failed',
      failure_reason: failureReason || 'Payment failed',
    })
    .eq('stripe_payment_intent_id', paymentIntentId)
}

// =====================================================
// CREATE REFUND (Supports both HitPay and Stripe)
// =====================================================

export async function createRefund(
  requesterId: string,
  request: CreateRefundRequest
): Promise<Refund> {
  await requirePermission(requesterId, 'tokens', 'adjust')

  const { paymentId, amountCents, reason } = request

  // Get payment
  const { data: payment } = await getSupabaseAdminClient()
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single()

  if (!payment) {
    throw new ApiError('NOT_FOUND_ERROR', 'Payment not found', 404)
  }

  if (payment.status !== 'succeeded') {
    throw new ApiError('VALIDATION_ERROR', 'Can only refund succeeded payments', 400)
  }

  const refundAmount = amountCents || payment.amount_cents
  const provider = payment.provider || 'hitpay'

  let externalRefundId: string | null = null
  let refundStatus: 'pending' | 'succeeded' | 'failed' = 'pending'

  if (provider === 'hitpay') {
    // HitPay refund
    if (!payment.hitpay_payment_id) {
      throw new ApiError('VALIDATION_ERROR', 'Payment has no HitPay payment ID', 400)
    }

    try {
      const hitpayRefund = await hitpayCreateRefund({
        payment_id: payment.hitpay_payment_id,
        amount: refundAmount ? centsToAmount(refundAmount) : undefined,
      })
      externalRefundId = hitpayRefund.id
      refundStatus = hitpayRefund.status === 'succeeded' ? 'succeeded' : 'pending'
    } catch (error) {
      console.error('[HitPay] Refund failed:', error)
      throw new ApiError('SERVER_ERROR', 'Failed to create refund with HitPay', 500)
    }
  } else if (provider === 'stripe') {
    // Stripe refund (legacy)
  if (!payment.stripe_payment_intent_id) {
    throw new ApiError('VALIDATION_ERROR', 'Payment has no Stripe intent', 400)
  }

  const stripe = await getStripe()
  const stripeRefund = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
    amount: refundAmount,
    reason: 'requested_by_customer',
    metadata: {
      requester_id: requesterId,
      reason: reason || 'Refund requested',
    },
  })
    externalRefundId = stripeRefund.id
    refundStatus = stripeRefund.status === 'succeeded' ? 'succeeded' : 'pending'
  } else {
    throw new ApiError('VALIDATION_ERROR', 'Unknown payment provider', 400)
  }

  // Create refund record
  const { data: refund, error } = await getSupabaseAdminClient()
    .from('refunds')
    .insert({
      payment_id: paymentId,
      amount_cents: refundAmount,
      reason,
      stripe_refund_id: externalRefundId, // Using same field for both providers
      status: refundStatus,
      processed_by: requesterId,
    })
    .select()
    .single()

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to create refund record', 500, error)
  }

  // Update payment status
  const newStatus = refundAmount >= payment.amount_cents ? 'refunded' : 'partially_refunded'
  await getSupabaseAdminClient()
    .from('payments')
    .update({ status: newStatus })
    .eq('id', paymentId)

  // Audit log
  await createAuditLog({
    userId: requesterId,
    action: 'refund.create',
    resourceType: 'refunds',
    resourceId: refund.id,
    newValues: {
      payment_id: paymentId,
      amount_cents: refundAmount,
      reason,
      provider,
    },
  })

  return {
    id: refund.id,
    paymentId: refund.payment_id,
    userPackageId: refund.user_package_id,
    amountCents: refund.amount_cents,
    reason: refund.reason,
    stripeRefundId: refund.stripe_refund_id,
    status: refund.status,
    processedBy: refund.processed_by,
    createdAt: refund.created_at,
  }
}

// =====================================================
// GET USER PAYMENTS
// =====================================================

export async function getUserPayments(
  userId: string,
  query: PaymentListQuery
): Promise<PaymentListResponse> {
  const { page, pageSize, status, startDate, endDate } = query
  const offset = (page - 1) * pageSize

  let dbQuery = getSupabaseAdminClient()
    .from('payments')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (status) {
    dbQuery = dbQuery.eq('status', status)
  }
  if (startDate) {
    dbQuery = dbQuery.gte('created_at', startDate)
  }
  if (endDate) {
    dbQuery = dbQuery.lte('created_at', endDate)
  }

  dbQuery = dbQuery.range(offset, offset + pageSize - 1)

  const { data, error, count } = await dbQuery

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch payments', 500, error)
  }

  const total = count || 0

  return {
    payments: (data || []).map(toPayment),
    meta: {
      total,
      page,
      pageSize,
      hasMore: offset + (data?.length || 0) < total,
    },
  }
}

// =====================================================
// GET ALL PAYMENTS (Admin)
// =====================================================

export async function getAllPayments(
  requesterId: string,
  query: AdminPaymentListQuery
): Promise<PaymentListResponse> {
  await requirePermission(requesterId, 'tokens', 'view_all')

  const { page, pageSize, status, startDate, endDate, userId } = query
  const offset = (page - 1) * pageSize

  let dbQuery = getSupabaseAdminClient()
    .from('payments')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (userId) {
    dbQuery = dbQuery.eq('user_id', userId)
  }
  if (status) {
    dbQuery = dbQuery.eq('status', status)
  }
  if (startDate) {
    dbQuery = dbQuery.gte('created_at', startDate)
  }
  if (endDate) {
    dbQuery = dbQuery.lte('created_at', endDate)
  }

  dbQuery = dbQuery.range(offset, offset + pageSize - 1)

  const { data, error, count } = await dbQuery

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch payments', 500, error)
  }

  const total = count || 0

  return {
    payments: (data || []).map(toPayment),
    meta: {
      total,
      page,
      pageSize,
      hasMore: offset + (data?.length || 0) < total,
    },
  }
}

// =====================================================
// GET PAYMENT BY ID
// =====================================================

export async function getPayment(
  userId: string,
  paymentId: string
): Promise<Payment> {
  const { data, error } = await getSupabaseAdminClient()
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single()

  if (error || !data) {
    throw new ApiError('NOT_FOUND_ERROR', 'Payment not found', 404)
  }

  // Check ownership or admin
  if (data.user_id !== userId) {
    await requirePermission(userId, 'tokens', 'view_all')
  }

  return toPayment(data)
}

// =====================================================
// CREATE INVOICE
// =====================================================

async function createInvoice(
  userId: string,
  paymentId: string,
  amountCents: number
): Promise<Invoice> {
  // Generate invoice number
  const { data: invoiceNumber } = await getSupabaseAdminClient().rpc('generate_invoice_number')

  const { data, error } = await getSupabaseAdminClient()
    .from('invoices')
    .insert({
      user_id: userId,
      payment_id: paymentId,
      invoice_number: invoiceNumber || `INV-${Date.now()}`,
      amount_cents: amountCents,
      tax_cents: 0, // No tax for now
      total_cents: amountCents,
      status: 'paid',
      issued_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[Payment] Failed to create invoice:', error)
    throw new ApiError('SERVER_ERROR', 'Failed to create invoice', 500, error)
  }

  return toInvoice(data)
}

// =====================================================
// GET USER INVOICES
// =====================================================

export async function getUserInvoices(
  userId: string,
  query: InvoiceListQuery
): Promise<InvoiceListResponse> {
  const { page, pageSize, status, startDate, endDate } = query
  const offset = (page - 1) * pageSize

  let dbQuery = getSupabaseAdminClient()
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (status) {
    dbQuery = dbQuery.eq('status', status)
  }
  if (startDate) {
    dbQuery = dbQuery.gte('created_at', startDate)
  }
  if (endDate) {
    dbQuery = dbQuery.lte('created_at', endDate)
  }

  dbQuery = dbQuery.range(offset, offset + pageSize - 1)

  const { data, error, count } = await dbQuery

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch invoices', 500, error)
  }

  const total = count || 0

  return {
    invoices: (data || []).map(toInvoice),
    meta: {
      total,
      page,
      pageSize,
      hasMore: offset + (data?.length || 0) < total,
    },
  }
}

// =====================================================
// GET PAYMENT METHODS
// =====================================================

export async function getPaymentMethods(
  userId: string
): Promise<PaymentMethodListResponse> {
  const customerId = await getOrCreateStripeCustomer(userId)
  
  const stripe = await getStripe()
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  })

  // Get default payment method
  const { data: customerData } = await getSupabaseAdminClient()
    .from('stripe_customers')
    .select('default_payment_method_id')
    .eq('user_id', userId)
    .single()

  const paymentMethods: PaymentMethod[] = methods.data.map(pm => ({
    id: pm.id,
    type: pm.type,
    card: pm.card ? {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    } : undefined,
    isDefault: pm.id === customerData?.default_payment_method_id,
  }))

  return {
    paymentMethods,
    defaultPaymentMethodId: customerData?.default_payment_method_id || null,
  }
}

// =====================================================
// SET DEFAULT PAYMENT METHOD
// =====================================================

export async function setDefaultPaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<void> {
  const customerId = await getOrCreateStripeCustomer(userId)
  
  const stripe = await getStripe()
  
  // Update in Stripe
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  })

  // Update in database
  await getSupabaseAdminClient()
    .from('stripe_customers')
    .update({ default_payment_method_id: paymentMethodId })
    .eq('user_id', userId)
}

// =====================================================
// DELETE PAYMENT METHOD
// =====================================================

export async function deletePaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<void> {
  const stripe = await getStripe()
  
  // Verify ownership
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
  
  const { data: customerData } = await getSupabaseAdminClient()
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  if (paymentMethod.customer !== customerData?.stripe_customer_id) {
    throw new ApiError('AUTHORIZATION_ERROR', 'Payment method does not belong to user', 403)
  }

  // Detach from customer
  await stripe.paymentMethods.detach(paymentMethodId)
}
