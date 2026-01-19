/**
 * Forgot Password API Route
 * POST /api/auth/forgot-password - Generate and send 6-digit OTP code via email
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { z } from 'zod'

const ForgotPasswordRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

/**
 * Generate a 6-digit OTP code
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * POST /api/auth/forgot-password - Generate and send OTP code
 * New OTP-based flow instead of recovery links
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parseResult = ForgotPasswordRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid email address',
          details: parseResult.error.issues 
        },
        { status: 400 }
      )
    }

    const { email } = parseResult.data
    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists
    const adminClient = getSupabaseAdminClient()
    const { data: userProfile, error: userError } = await adminClient
      .from(TABLES.USER_PROFILES)
      .select('id, email, name')
      .eq('email', normalizedEmail)
      .single()

    // Don't reveal if email exists or not (security best practice)
    // Always return success to prevent email enumeration
    if (userError || !userProfile) {
      console.log(`[ForgotPassword] Email not found: ${email}`)
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a verification code has been sent.',
      })
    }

    // Generate 6-digit OTP code
    const otpCode = generateOTP()
    
    // OTP expires in 15 minutes
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 15)

    // Delete any existing unverified OTPs for this email
    await adminClient
      .from(TABLES.PASSWORD_RESET_OTPS)
      .delete()
      .eq('email', normalizedEmail)
      .eq('verified', false)

    // Store OTP in database
    const { error: otpError } = await adminClient
      .from(TABLES.PASSWORD_RESET_OTPS)
      .insert({
        user_id: userProfile.id,
        email: normalizedEmail,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        verified: false,
      })

    if (otpError) {
      console.error('[ForgotPassword] Error storing OTP:', otpError)
      // Still return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a verification code has been sent.',
      })
    }

    // Get base URL for verify-otp page
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ||
                         process.env.NEXT_PUBLIC_APP_URL?.includes('vercel.app')
    
    const baseUrl = isDevelopment
      ? (process.env.NEXT_PUBLIC_APP_URL ||
         (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001'))
      : (process.env.NEXT_PUBLIC_APP_URL || 'https://admin.zumbaton.sg')

    // Send OTP email using the web app's custom email service
    try {
      const { getWebAppUrl } = await import('@/lib/email-url')
      const webAppUrl = getWebAppUrl()
      const emailApiSecret = process.env.EMAIL_API_SECRET || process.env.NEXT_PUBLIC_EMAIL_API_SECRET || 'change-me-in-production'

      const emailResponse = await fetch(`${webAppUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'forgot-password-otp',
          secret: emailApiSecret,
          data: {
            userEmail: userProfile.email,
            userName: userProfile.name || 'User',
            otpCode: otpCode,
            verifyUrl: `${baseUrl}/verify-otp`,
            expiresIn: '15 minutes',
          },
        }),
      })

      if (!emailResponse.ok) {
        const emailResult = await emailResponse.json().catch(() => ({}))
        console.error('[ForgotPassword] Error sending OTP email:', emailResult.error || `HTTP ${emailResponse.status}`)
        console.error('[ForgotPassword] Email API URL:', `${webAppUrl}/api/email/send`)
        // Still return success to prevent email enumeration
      } else {
        const emailResult = await emailResponse.json().catch(() => ({}))
        console.log(`[ForgotPassword] OTP code sent to ${userProfile.email}`)
      }
    } catch (emailError) {
      console.error('[ForgotPassword] Error sending OTP email:', emailError)
      // Still return success to prevent email enumeration
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a verification code has been sent.',
    })
  } catch (error) {
    console.error('[ForgotPassword] Error in forgot password endpoint:', error)
    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  }
}

