import { z } from 'zod'
import { UuidSchema, DateTimeSchema } from './common'

// Check-in method - aligned with TOKEN_ENGINE_PLAN.md
export const CheckInMethodSchema = z.enum([
  'manual',
  'qr-code',
  'auto',
  'admin'
])
export type CheckInMethod = z.infer<typeof CheckInMethodSchema>

// Attendance entity - matches Supabase 'attendances' table
export const AttendanceSchema = z.object({
  id: UuidSchema,
  bookingId: UuidSchema,
  checkedInAt: DateTimeSchema,
  checkedInBy: UuidSchema.nullable(),
  checkInMethod: CheckInMethodSchema.default('manual'),
  notes: z.string().max(500).nullable(),
  createdAt: DateTimeSchema,
})
export type Attendance = z.infer<typeof AttendanceSchema>

// Request: Check in (single)
export const CheckInRequestSchema = z.object({
  bookingId: UuidSchema,
  method: CheckInMethodSchema.default('manual'),
  notes: z.string().max(500).optional(),
})
export type CheckInRequest = z.infer<typeof CheckInRequestSchema>

// Response: Check in confirmation
export const CheckInResponseSchema = z.object({
  attendance: AttendanceSchema,
  tokensConsumed: z.number().int().positive(),
  tokensRemaining: z.number().int().nonnegative(),
  message: z.string(),
})
export type CheckInResponse = z.infer<typeof CheckInResponseSchema>

// Request: Bulk check in (admin)
export const BulkCheckInRequestSchema = z.object({
  bookingIds: z.array(UuidSchema).min(1, 'At least one booking required').max(50, 'Maximum 50 bookings per request'),
  method: CheckInMethodSchema.default('admin'),
  notes: z.string().max(500).optional(),
})
export type BulkCheckInRequest = z.infer<typeof BulkCheckInRequestSchema>

// Response: Bulk check in result
export const BulkCheckInResponseSchema = z.object({
  successful: z.array(z.object({
    bookingId: UuidSchema,
    attendanceId: UuidSchema,
    userName: z.string(),
  })),
  failed: z.array(z.object({
    bookingId: UuidSchema,
    error: z.string(),
  })),
  summary: z.object({
    totalProcessed: z.number().int().nonnegative(),
    totalSuccessful: z.number().int().nonnegative(),
    totalFailed: z.number().int().nonnegative(),
  }),
})
export type BulkCheckInResponse = z.infer<typeof BulkCheckInResponseSchema>

// Request: Mark no-show
export const MarkNoShowRequestSchema = z.object({
  bookingId: UuidSchema,
  notes: z.string().max(500).optional(),
})
export type MarkNoShowRequest = z.infer<typeof MarkNoShowRequestSchema>

// Response: No-show marked
export const MarkNoShowResponseSchema = z.object({
  bookingId: UuidSchema,
  tokensConsumed: z.number().int().positive(),
  userNoShowCount: z.number().int().nonnegative(),
  userFlagged: z.boolean(),
  message: z.string(),
})
export type MarkNoShowResponse = z.infer<typeof MarkNoShowResponseSchema>

// QR code data (for user check-in)
export const QRCodeDataSchema = z.object({
  bookingId: UuidSchema,
  classId: UuidSchema,
  userId: UuidSchema,
  expiresAt: DateTimeSchema,
  signature: z.string(), // HMAC signature for verification
})
export type QRCodeData = z.infer<typeof QRCodeDataSchema>

// Request: Generate QR code
export const GenerateQRRequestSchema = z.object({
  bookingId: UuidSchema,
})
export type GenerateQRRequest = z.infer<typeof GenerateQRRequestSchema>

// Response: QR code generated
export const GenerateQRResponseSchema = z.object({
  qrCode: z.string(), // base64 encoded QR image
  qrData: z.string(), // JSON string of QRCodeData
  expiresAt: DateTimeSchema,
})
export type GenerateQRResponse = z.infer<typeof GenerateQRResponseSchema>

// Request: Verify QR code
export const VerifyQRRequestSchema = z.object({
  qrData: z.string(), // JSON string from QR scan
})
export type VerifyQRRequest = z.infer<typeof VerifyQRRequestSchema>

// Response: QR verification result
export const VerifyQRResponseSchema = z.object({
  valid: z.boolean(),
  booking: z.object({
    id: UuidSchema,
    userId: UuidSchema,
    userName: z.string(),
    classId: UuidSchema,
    className: z.string(),
  }).optional(),
  error: z.string().optional(),
})
export type VerifyQRResponse = z.infer<typeof VerifyQRResponseSchema>
