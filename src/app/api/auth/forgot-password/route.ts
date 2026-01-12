/**
 * Forgot Password API Route
 * POST /api/auth/forgot-password - Send password reset email
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { z } from 'zod'

const ForgotPasswordRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

/**
 * POST /api/auth/forgot-password - Send password reset email
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

    // Get the base URL for the redirect link
    // Always use production domain for production emails (unless explicitly overridden)
    // For development, use localhost or the configured URL
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ||
                         process.env.NEXT_PUBLIC_APP_URL?.includes('vercel.app')
    
    const baseUrl = isDevelopment
      ? (process.env.NEXT_PUBLIC_APP_URL ||
         (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'))
      : (process.env.NEXT_PUBLIC_APP_URL || 'https://admin.zumbaton.sg')
    
    // Construct the redirect URL - this should point to your set-password page
    const redirectTo = `${baseUrl}/set-password`

    // Use Supabase client to send password reset email
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      console.error('Error sending password reset email:', error)
      
      // Don't reveal if email exists or not (security best practice)
      // Always return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('Error in forgot password endpoint:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to process password reset request'
      },
      { status: 500 }
    )
  }
}

