import { NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import crypto from 'crypto'

/**
 * POST /api/registration-form/send
 * Generate registration form token and send email to user
 */
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdminClient()
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from(TABLES.USER_PROFILES)
      .select('id, name, email')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.email) {
      return NextResponse.json(
        { success: false, error: 'User does not have an email address' },
        { status: 400 }
      )
    }

    // Generate unique token
    const formToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create registration form record
    const { data: formRecord, error: formError } = await supabase
      .from(TABLES.REGISTRATION_FORMS)
      .insert({
        user_id: userId,
        form_token: formToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        form_sent_at: new Date().toISOString(),
        status: 'pending',
      })
      .select()
      .single()

    if (formError) {
      console.error('Error creating form record:', formError)
      return NextResponse.json(
        { success: false, error: 'Failed to create form record' },
        { status: 500 }
      )
    }

    // Update user profile to track when form was sent
    await supabase
      .from(TABLES.USER_PROFILES)
      .update({ registration_form_sent_at: new Date().toISOString() })
      .eq('id', userId)

    // Generate form URL - CRITICAL: Must use production URL
    // Use NEXT_PUBLIC_WEB_APP_URL (which is set in Vercel) or fallback to NEXT_PUBLIC_APP_URL
    const baseUrl = process.env.NEXT_PUBLIC_WEB_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://zumbaton.sg'
    if (!baseUrl || baseUrl === 'http://localhost:3000') {
      console.error('[Registration Form] CRITICAL: Invalid or missing web URL in production. Got:', baseUrl)
    }
    const formUrl = `${baseUrl}/registration-form/${formToken}`

    // Send email using the email API
    try {
      const { getWebAppUrl } = await import('@/lib/email-url')
      const webAppUrl = getWebAppUrl()
      const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'
      
      console.log('[Registration Form] Sending email to:', user.email)
      console.log('[Registration Form] Email API URL:', `${webAppUrl}/api/email/send`)
      
      const emailResponse = await fetch(`${webAppUrl}/api/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'registration-form',
          secret: emailApiSecret,
          data: {
            userEmail: user.email,
            userName: user.name,
            formUrl,
          },
        }),
      })

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text()
        console.error('[Registration Form] Email API error:', {
          status: emailResponse.status,
          statusText: emailResponse.statusText,
          body: errorText,
        })
        throw new Error(`Email API returned ${emailResponse.status}: ${errorText}`)
      }
      
      const emailResult = await emailResponse.json()
      console.log('[Registration Form] Email sent successfully:', emailResult)
    } catch (emailError) {
      console.error('[Registration Form] Error sending email:', emailError)
      // Don't fail the request if email fails, form record is created
    }

    return NextResponse.json({
      success: true,
      data: {
        formId: formRecord.id,
        formUrl,
        expiresAt: tokenExpiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in send registration form:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
