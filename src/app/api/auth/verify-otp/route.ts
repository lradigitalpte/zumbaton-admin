/**
 * Verify OTP API Route
 * POST /api/auth/verify-otp - Verify 6-digit OTP code for password reset
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { z } from 'zod'

const VerifyOTPRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  otpCode: z.string().length(6, 'OTP code must be 6 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  // If password is provided, confirmPassword must match
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

/**
 * POST /api/auth/verify-otp - Verify OTP code and return reset token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parseResult = VerifyOTPRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid request',
          details: parseResult.error.issues 
        },
        { status: 400 }
      )
    }

    const { email, otpCode, password, confirmPassword } = parseResult.data
    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists
    const adminClient = getSupabaseAdminClient()
    const { data: userProfile, error: userError } = await adminClient
      .from(TABLES.USER_PROFILES)
      .select('id, email, name')
      .eq('email', normalizedEmail)
      .single()

    // Don't reveal if email exists or not (security best practice)
    if (userError || !userProfile) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid verification code',
        },
        { status: 400 }
      )
    }

    // Find valid OTP for this email
    const { data: otpRecord, error: otpError } = await adminClient
      .from(TABLES.PASSWORD_RESET_OTPS)
      .select('id, user_id, otp_code, expires_at, verified')
      .eq('email', normalizedEmail)
      .eq('otp_code', otpCode)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (otpError || !otpRecord) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid or expired verification code',
        },
        { status: 400 }
      )
    }

    // Verify the OTP belongs to the correct user
    if (otpRecord.user_id !== userProfile.id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid verification code',
        },
        { status: 400 }
      )
    }

    // If password is provided, verify OTP and update password in one step
    if (password) {
      // Validate password confirmation
      if (password !== confirmPassword) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Passwords do not match',
          },
          { status: 400 }
        )
      }

      // Mark OTP as verified
      await adminClient
        .from(TABLES.PASSWORD_RESET_OTPS)
        .update({ 
          verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq('id', otpRecord.id)

      // Update password using Supabase Admin API
      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        userProfile.id,
        { password: password }
      )

      if (updateError) {
        console.error('[VerifyOTP] Error updating password:', updateError)
        return NextResponse.json(
          { 
            success: false,
            error: 'Failed to update password. Please try again.',
          },
          { status: 500 }
        )
      }

      // Success! Password updated
      console.log(`[VerifyOTP] Password updated successfully for user ${userProfile.email}`)
      return NextResponse.json({
        success: true,
        message: 'Password updated successfully',
      })
    }

    // If no password provided, just verify OTP and return success (shouldn't happen in new flow)
    // Mark OTP as verified
    await adminClient
      .from(TABLES.PASSWORD_RESET_OTPS)
      .update({ 
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', otpRecord.id)

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
    })
  } catch (error) {
    console.error('[VerifyOTP] Error in verify OTP endpoint:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to verify code',
      },
      { status: 500 }
    )
  }
}
