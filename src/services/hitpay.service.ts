/**
 * HitPay Payment Gateway Service
 *
 * HitPay is a Singapore-based payment gateway supporting:
 * - PayNow (QR code payments)
 * - Credit/Debit Cards (Visa, Mastercard, Amex)
 * - GrabPay
 * - Apple Pay / Google Pay
 * - AliPay / WeChat Pay
 *
 * Documentation: https://docs.hitpayapp.com/
 */

import crypto from 'crypto'

// =====================================================
// CONFIGURATION
// =====================================================

// Environment: 'sandbox' (default for testing) or 'production' (live payments)
const HITPAY_ENV = process.env.HITPAY_ENV || 'sandbox'

const HITPAY_API_URL =
  HITPAY_ENV === 'production'
    ? 'https://api.hit-pay.com/v1'
    : 'https://api.sandbox.hit-pay.com/v1'

const HITPAY_API_KEY = process.env.HITPAY_API_KEY
const HITPAY_SALT = process.env.HITPAY_SALT

// Log which environment is being used (helpful for debugging)
if (typeof window === 'undefined') {
  console.log(`[HitPay] Using ${HITPAY_ENV} environment`)
}

// =====================================================
// TYPES
// =====================================================

export interface HitPayPaymentRequest {
  amount: number // Amount in decimal (e.g., 10.50)
  currency: string // SGD, USD, etc.
  email: string
  name: string
  purpose?: string // Description of the payment
  reference_number?: string // Your internal reference
  redirect_url?: string // URL to redirect after payment
  webhook?: string // URL to receive payment status updates
  payment_methods?: string[] // Optional: restrict to specific methods
  send_email?: boolean // Send receipt email
  allow_repeated_payments?: boolean
  expires_after?: string // ISO date for expiry
}

export interface HitPayPaymentResponse {
  id: string
  name: string
  email: string
  phone: string | null
  amount: string
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'expired' | 'refunded'
  purpose: string | null
  reference_number: string | null
  payment_methods: string[] | null
  url: string // HitPay checkout URL
  redirect_url: string | null
  webhook: string | null
  send_sms: boolean
  send_email: boolean
  sms_status: string | null
  email_status: string | null
  allow_repeated_payments: boolean
  expiry_date: string | null
  created_at: string
  updated_at: string
}

export interface HitPayWebhookPayload {
  payment_id: string
  payment_request_id: string
  phone: string | null
  amount: string
  currency: string
  status: 'completed' | 'failed' | 'pending' | 'refunded'
  reference_number: string | null
  hmac: string
}

export interface HitPayRefundRequest {
  payment_id: string
  amount?: number // Optional partial refund amount
}

export interface HitPayRefundResponse {
  id: string
  payment_id: string
  amount_refunded: string
  total_amount: string
  currency: string
  status: string
  created_at: string
}

export interface HitPayPaymentStatus {
  id: string
  name: string
  email: string
  amount: string
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'expired' | 'refunded'
  reference_number: string | null
  payments: HitPayPaymentDetail[]
}

export interface HitPayPaymentDetail {
  id: string
  amount: string
  status: string
  payment_type: string
  created_at: string
}

// Available payment methods in HitPay (Singapore)
export const HITPAY_PAYMENT_METHODS = {
  paynow_online: 'PayNow QR',
  card: 'Credit/Debit Card',
  grabpay: 'GrabPay',
  alipay: 'AliPay',
  wechat: 'WeChat Pay',
  shopee_pay: 'Shopee Pay',
  zip: 'Zip (Buy Now Pay Later)',
  atome: 'Atome (Buy Now Pay Later)',
} as const

export type HitPayPaymentMethod = keyof typeof HITPAY_PAYMENT_METHODS

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Make an authenticated request to HitPay API
 */
async function hitpayRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!HITPAY_API_KEY) {
    throw new Error('HITPAY_API_KEY is not configured')
  }

  const url = `${HITPAY_API_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-BUSINESS-API-KEY': HITPAY_API_KEY,
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('[HitPay] API Error:', data)
    throw new Error(data.message || data.error || 'HitPay API error')
  }

  return data as T
}

/**
 * Verify HitPay webhook signature using HMAC-SHA256
 *
 * HitPay sends a webhook with an `hmac` field that should be verified:
 * 1. Collect all key-value pairs excluding 'hmac'
 * 2. Sort alphabetically by key
 * 3. Concatenate all values
 * 4. Generate HMAC-SHA256 with the salt
 */
export function verifyHitPayWebhook(
  payload: Record<string, string | null>,
  providedHmac: string
): boolean {
  if (!HITPAY_SALT) {
    console.error('[HitPay] HITPAY_SALT is not configured')
    return false
  }

  // Remove hmac from payload for verification
  const dataToSign = { ...payload }
  delete dataToSign.hmac

  // Sort keys alphabetically and concatenate values
  const sortedKeys = Object.keys(dataToSign).sort()
  const signatureSource = sortedKeys
    .map((key) => dataToSign[key] ?? '')
    .join('')

  // Generate HMAC-SHA256
  const calculatedHmac = crypto
    .createHmac('sha256', HITPAY_SALT)
    .update(signatureSource)
    .digest('hex')

  return calculatedHmac === providedHmac
}

// =====================================================
// API FUNCTIONS
// =====================================================

/**
 * Create a payment request
 * Returns a URL where the user can complete the payment
 */
export async function createPaymentRequest(
  request: HitPayPaymentRequest
): Promise<HitPayPaymentResponse> {
  const payload = {
    amount: request.amount.toFixed(2),
    currency: request.currency,
    email: request.email,
    name: request.name,
    purpose: request.purpose,
    reference_number: request.reference_number,
    redirect_url: request.redirect_url,
    webhook: request.webhook,
    payment_methods: request.payment_methods,
    send_email: request.send_email ?? true,
    allow_repeated_payments: request.allow_repeated_payments ?? false,
    expires_after: request.expires_after,
  }

  // Remove undefined values
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined)
  )

  const response = await hitpayRequest<HitPayPaymentResponse>(
    '/payment-requests',
    {
      method: 'POST',
      body: JSON.stringify(cleanPayload),
    }
  )

  return response
}

/**
 * Get payment request status
 */
export async function getPaymentRequestStatus(
  paymentRequestId: string
): Promise<HitPayPaymentStatus> {
  return hitpayRequest<HitPayPaymentStatus>(
    `/payment-requests/${paymentRequestId}`
  )
}

/**
 * Delete a payment request (cancel it)
 */
export async function deletePaymentRequest(
  paymentRequestId: string
): Promise<void> {
  await hitpayRequest(`/payment-requests/${paymentRequestId}`, {
    method: 'DELETE',
  })
}

/**
 * Create a refund
 */
export async function createRefund(
  request: HitPayRefundRequest
): Promise<HitPayRefundResponse> {
  const payload: Record<string, string> = {
    payment_id: request.payment_id,
  }

  if (request.amount !== undefined) {
    payload.amount = request.amount.toFixed(2)
  }

  return hitpayRequest<HitPayRefundResponse>('/refund', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Get list of payment requests
 */
export async function listPaymentRequests(params?: {
  page?: number
  per_page?: number
  status?: string
}): Promise<{ data: HitPayPaymentResponse[]; total: number }> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.per_page) searchParams.set('per_page', String(params.per_page))
  if (params?.status) searchParams.set('status', params.status)

  const query = searchParams.toString() ? `?${searchParams.toString()}` : ''

  return hitpayRequest<{ data: HitPayPaymentResponse[]; total: number }>(
    `/payment-requests${query}`
  )
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Get the appropriate redirect URL after payment
 */
export function getRedirectUrl(
  baseUrl: string,
  status: 'success' | 'cancel'
): string {
  return `${baseUrl}/payment/${status}`
}

/**
 * Get the webhook URL for HitPay callbacks
 */
export function getWebhookUrl(baseUrl: string): string {
  return `${baseUrl}/api/payments/hitpay-webhook`
}

/**
 * Format amount from cents to dollars
 */
export function centsToAmount(cents: number): number {
  return cents / 100
}

/**
 * Format amount from dollars to cents
 */
export function amountToCents(amount: number | string): number {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  return Math.round(numAmount * 100)
}

/**
 * Check if HitPay is properly configured
 */
export function isHitPayConfigured(): boolean {
  return Boolean(HITPAY_API_KEY && HITPAY_SALT)
}

/**
 * Get available payment methods based on configuration
 */
export function getAvailablePaymentMethods(): string[] {
  // Return all methods by default, can be filtered based on merchant settings
  return Object.keys(HITPAY_PAYMENT_METHODS)
}
