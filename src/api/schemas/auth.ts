import { z } from 'zod'
import { UuidSchema, EmailSchema, PasswordSchema, RoleSchema, BaseTimestampsSchema } from './common'

export const SignUpRequestSchema = z.object({
  name: z.string().min(1).max(255),
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const SignInRequestSchema = z.object({
  email: EmailSchema,
  password: z.string(),
})

export const UserResponseSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  email: EmailSchema,
  role: RoleSchema,
  ...BaseTimestampsSchema.shape,
})

export const AuthTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().positive(),
})

export const SignUpResponseSchema = z.object({
  user: UserResponseSchema,
  tokens: AuthTokenResponseSchema,
})

export const SignInResponseSchema = z.object({
  user: UserResponseSchema,
  tokens: AuthTokenResponseSchema,
})

export const RefreshTokenRequestSchema = z.object({
  refresh_token: z.string(),
})

export const RefreshTokenResponseSchema = AuthTokenResponseSchema

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string(),
  newPassword: PasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type SignUpRequest = z.infer<typeof SignUpRequestSchema>
export type SignInRequest = z.infer<typeof SignInRequestSchema>
export type UserResponse = z.infer<typeof UserResponseSchema>
export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>
export type SignUpResponse = z.infer<typeof SignUpResponseSchema>
export type SignInResponse = z.infer<typeof SignInResponseSchema>
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>
