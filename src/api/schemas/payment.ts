import { z } from 'zod'

// =====================================================
// PAYMENT PROVIDER
// =====================================================

export const PaymentProviderSchema = z.enum(['hitpay', 'stripe', 'manual'])
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>

// =====================================================
// PAYMENT STATUS
// =====================================================

export const PaymentStatusSchema = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
  'expired', // HitPay specific
])
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>

export const RefundStatusSchema = z.enum(['pending', 'succeeded', 'failed'])
export type RefundStatus = z.infer<typeof RefundStatusSchema>

export const InvoiceStatusSchema = z.enum(['draft', 'issued', 'paid', 'void', 'overdue'])
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>

// =====================================================
// HITPAY PAYMENT METHODS (Singapore)
// =====================================================

export const HitPayPaymentMethodSchema = z.enum([
  'paynow_online', // PayNow QR
  'card', // Credit/Debit Card
  'grabpay', // GrabPay
  'alipay', // AliPay
  'wechat', // WeChat Pay
  'shopee_pay', // Shopee Pay
  'zip', // Buy Now Pay Later
  'atome', // Buy Now Pay Later
])
export type HitPayPaymentMethod = z.infer<typeof HitPayPaymentMethodSchema>

// =====================================================
// PAYMENT SCHEMAS
// =====================================================

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  packageId: z.string().uuid().nullable(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default('SGD'), // Default to SGD for Singapore
  status: PaymentStatusSchema,
  paymentMethod: z.string().nullable(),
  provider: PaymentProviderSchema.default('hitpay'),
  // HitPay fields
  hitpayPaymentRequestId: z.string().nullable(),
  hitpayPaymentId: z.string().nullable(),
  hitpayPaymentUrl: z.string().nullable(),
  // Stripe fields (legacy support)
  stripePaymentIntentId: z.string().nullable(),
  stripeCustomerId: z.string().nullable(),
  stripeChargeId: z.string().nullable(),
  // Common fields
  receiptUrl: z.string().url().nullable(),
  failureReason: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Payment = z.infer<typeof PaymentSchema>

// =====================================================
// REFUND SCHEMAS
// =====================================================

export const RefundSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  userPackageId: z.string().uuid().nullable(),
  amountCents: z.number().int().positive(),
  reason: z.string().nullable(),
  stripeRefundId: z.string().nullable(),
  status: RefundStatusSchema,
  processedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
})

export type Refund = z.infer<typeof RefundSchema>

// =====================================================
// INVOICE SCHEMAS
// =====================================================

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  paymentId: z.string().uuid().nullable(),
  invoiceNumber: z.string(),
  amountCents: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default('USD'),
  status: InvoiceStatusSchema,
  pdfUrl: z.string().url().nullable(),
  issuedAt: z.string().datetime().nullable(),
  dueAt: z.string().datetime().nullable(),
  paidAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export type Invoice = z.infer<typeof InvoiceSchema>

// =====================================================
// PAYMENT CUSTOMER SCHEMAS (Generic - works with any provider)
// =====================================================

export const PaymentCustomerSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  provider: PaymentProviderSchema,
  externalCustomerId: z.string().nullable(), // Stripe customer ID or future HitPay customer ID
  defaultPaymentMethodId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type PaymentCustomer = z.infer<typeof PaymentCustomerSchema>

// Legacy support for existing Stripe customers
export const StripeCustomerSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stripeCustomerId: z.string(),
  defaultPaymentMethodId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type StripeCustomer = z.infer<typeof StripeCustomerSchema>

// =====================================================
// REQUEST SCHEMAS
// =====================================================

// HitPay - Create payment request (primary)
export const CreatePaymentRequestSchema = z.object({
  packageId: z.string().uuid(),
  paymentMethods: z.array(HitPayPaymentMethodSchema).optional(), // Optional: limit to specific methods
  redirectUrl: z.string().url().optional(), // Custom redirect after payment
})

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>

// Legacy Stripe support
export const CreatePaymentIntentRequestSchema = z.object({
  packageId: z.string().uuid(),
  paymentMethodId: z.string().optional(), // For saved payment methods
})

export type CreatePaymentIntentRequest = z.infer<typeof CreatePaymentIntentRequestSchema>

export const ConfirmPaymentRequestSchema = z.object({
  paymentIntentId: z.string(),
  paymentMethodId: z.string(),
})

export type ConfirmPaymentRequest = z.infer<typeof ConfirmPaymentRequestSchema>

export const CreateRefundRequestSchema = z.object({
  paymentId: z.string().uuid(),
  amountCents: z.number().int().positive().optional(), // Partial refund, or full if not specified
  reason: z.string().max(500).optional(),
})

export type CreateRefundRequest = z.infer<typeof CreateRefundRequestSchema>

export const SavePaymentMethodRequestSchema = z.object({
  paymentMethodId: z.string(),
  setAsDefault: z.boolean().default(false),
})

export type SavePaymentMethodRequest = z.infer<typeof SavePaymentMethodRequestSchema>

// =====================================================
// QUERY SCHEMAS
// =====================================================

export const PaymentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: PaymentStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export type PaymentListQuery = z.infer<typeof PaymentListQuerySchema>

export const InvoiceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: InvoiceStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>

export const AdminPaymentListQuerySchema = PaymentListQuerySchema.extend({
  userId: z.string().uuid().optional(),
})

export type AdminPaymentListQuery = z.infer<typeof AdminPaymentListQuerySchema>

// =====================================================
// RESPONSE SCHEMAS
// =====================================================

// HitPay - Create payment response (primary)
export const CreatePaymentResponseSchema = z.object({
  paymentRequestId: z.string(),
  paymentUrl: z.string().url(), // Redirect user to this URL to complete payment
  amountCents: z.number().int().positive(),
  currency: z.string(),
  expiresAt: z.string().datetime().nullable(),
})

export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>

// Legacy Stripe support
export const CreatePaymentIntentResponseSchema = z.object({
  clientSecret: z.string(),
  paymentIntentId: z.string(),
  amountCents: z.number().int().positive(),
  currency: z.string(),
})

export type CreatePaymentIntentResponse = z.infer<typeof CreatePaymentIntentResponseSchema>

export const PaymentListResponseSchema = z.object({
  payments: z.array(PaymentSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasMore: z.boolean(),
  }),
})

export type PaymentListResponse = z.infer<typeof PaymentListResponseSchema>

export const InvoiceListResponseSchema = z.object({
  invoices: z.array(InvoiceSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasMore: z.boolean(),
  }),
})

export type InvoiceListResponse = z.infer<typeof InvoiceListResponseSchema>

export const PaymentMethodSchema = z.object({
  id: z.string(),
  type: z.string(),
  card: z.object({
    brand: z.string(),
    last4: z.string(),
    expMonth: z.number(),
    expYear: z.number(),
  }).optional(),
  isDefault: z.boolean(),
})

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>

export const PaymentMethodListResponseSchema = z.object({
  paymentMethods: z.array(PaymentMethodSchema),
  defaultPaymentMethodId: z.string().nullable(),
})

export type PaymentMethodListResponse = z.infer<typeof PaymentMethodListResponseSchema>

// =====================================================
// HITPAY WEBHOOK SCHEMAS
// =====================================================

export const HitPayWebhookPayloadSchema = z.object({
  payment_id: z.string(),
  payment_request_id: z.string(),
  phone: z.string().nullable(),
  amount: z.string(),
  currency: z.string(),
  status: z.enum(['completed', 'failed', 'pending', 'refunded']),
  reference_number: z.string().nullable(),
  hmac: z.string(),
})

export type HitPayWebhookPayload = z.infer<typeof HitPayWebhookPayloadSchema>

// HitPay webhook status types
export const HitPayWebhookStatusTypes = [
  'completed', // Payment successful
  'failed', // Payment failed
  'pending', // Payment still pending
  'refunded', // Payment was refunded
] as const

export type HitPayWebhookStatus = (typeof HitPayWebhookStatusTypes)[number]

// =====================================================
// STRIPE WEBHOOK SCHEMAS (Legacy Support)
// =====================================================

export const StripeWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.unknown()),
  }),
  created: z.number(),
})

export type StripeWebhookEvent = z.infer<typeof StripeWebhookEventSchema>

// Known webhook event types
export const StripeWebhookEventTypes = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const

export type StripeWebhookEventType = (typeof StripeWebhookEventTypes)[number]
