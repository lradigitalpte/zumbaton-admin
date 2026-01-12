/**
 * Forgot Password API Route
 * POST /api/auth/forgot-password - Send password reset email using custom SMTP
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { z } from 'zod'

const ForgotPasswordRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

/**
 * POST /api/auth/forgot-password - Send password reset email
 * Uses custom email service instead of Supabase's default
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

    // Check if user exists
    const adminClient = getSupabaseAdminClient()
    const { data: userProfile, error: userError } = await adminClient
      .from(TABLES.USER_PROFILES)
      .select('id, email, name')
      .eq('email', email.toLowerCase().trim())
      .single()

    // Don't reveal if email exists or not (security best practice)
    // Always return success to prevent email enumeration
    if (userError || !userProfile) {
      console.log(`[ForgotPassword] Email not found: ${email}`)
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Get the base URL for the redirect link
    // Always use admin.zumbaton.sg for production emails (unless explicitly overridden)
    // For development, use localhost or the configured URL
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ||
                         process.env.NEXT_PUBLIC_APP_URL?.includes('vercel.app')
    
    const baseUrl = isDevelopment
      ? (process.env.NEXT_PUBLIC_APP_URL ||
         (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001'))
      : (process.env.NEXT_PUBLIC_APP_URL || 'https://admin.zumbaton.sg')
    
    // Generate password recovery token using Supabase Admin API
    // This creates a secure recovery token that Supabase will validate
    const { data: recoveryData, error: recoveryError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: userProfile.email,
      options: {
        redirectTo: `${baseUrl}/set-password`,
      },
    })

    if (recoveryError || !recoveryData) {
      console.error('[ForgotPassword] Error generating recovery link:', recoveryError)
      // Still return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Extract the recovery link from the response
    let resetLink = recoveryData.properties?.action_link || 
                   recoveryData.properties?.redirect_to || 
                   `${baseUrl}/set-password`
    
    // Replace any localhost or Vercel URLs with the production domain
    if (resetLink && (resetLink.includes('localhost') || resetLink.includes('vercel.app'))) {
      try {
        const url = new URL(resetLink)
        const pathAndQuery = url.pathname + url.search
        const productionBase = baseUrl.replace(/\/$/, '')
        resetLink = `${productionBase}${pathAndQuery}`
      } catch (urlError) {
        const pathMatch = resetLink.match(/\/set-password[^?#]*(\?[^#]*)?(#.*)?/)
        const pathPart = pathMatch ? pathMatch[0] : '/set-password'
        resetLink = `${baseUrl.replace(/\/$/, '')}${pathPart}`
      }
    }

    // Send email using the web app's custom email service
    try {
      const webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL || 'http://localhost:3000'
      const emailApiSecret = process.env.EMAIL_API_SECRET || process.env.NEXT_PUBLIC_EMAIL_API_SECRET || 'change-me-in-production'

      const emailResponse = await fetch(`${webAppUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'forgot-password',
          secret: emailApiSecret,
          data: {
            userEmail: userProfile.email,
            userName: userProfile.name || 'User',
            resetLink: recoveryData.properties.action_link || resetLink,
            expiresIn: '1 hour',
          },
        }),
      })

      if (!emailResponse.ok) {
        const emailResult = await emailResponse.json().catch(() => ({}))
        console.error('[ForgotPassword] Error sending email:', emailResult.error || `HTTP ${emailResponse.status}`)
        console.error('[ForgotPassword] Email API URL:', `${webAppUrl}/api/email/send`)
        // Still return success to prevent email enumeration
      } else {
        const emailResult = await emailResponse.json().catch(() => ({}))
        console.log(`[ForgotPassword] Password reset email sent to ${userProfile.email}`)
      }
    } catch (emailError) {
      console.error('[ForgotPassword] Error sending email:', emailError)
      // Still return success to prevent email enumeration
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
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

