import { z } from 'zod'

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
])
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>

export const RefundStatusSchema = z.enum(['pending', 'succeeded', 'failed'])
export type RefundStatus = z.infer<typeof RefundStatusSchema>

export const InvoiceStatusSchema = z.enum(['draft', 'issued', 'paid', 'void', 'overdue'])
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>

// =====================================================
// PAYMENT SCHEMAS
// =====================================================

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  packageId: z.string().uuid().nullable(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default('USD'),
  status: PaymentStatusSchema,
  paymentMethod: z.string().nullable(),
  stripePaymentIntentId: z.string().nullable(),
  stripeCustomerId: z.string().nullable(),
  stripeChargeId: z.string().nullable(),
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
// STRIPE CUSTOMER SCHEMAS
// =====================================================

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
// STRIPE WEBHOOK SCHEMAS
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
