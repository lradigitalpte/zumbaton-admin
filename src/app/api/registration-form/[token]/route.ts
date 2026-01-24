import { NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'

// CORS headers for public access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

/**
 * GET /api/registration-form/[token]
 * Fetch registration form by token (public endpoint)
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = getSupabaseAdminClient()

    const { token } = await context.params

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Fetch form by token
    const { data: form, error: formError } = await supabase
      .from(TABLES.REGISTRATION_FORMS)
      .select(`
        id,
        user_id,
        token_expires_at,
        status,
        form_completed_at,
        user_profiles!registration_forms_user_id_fkey (
          name,
          email,
          phone,
          date_of_birth
        )
      `)
      .eq('form_token', token)
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired form link' },
        { status: 404 }
      )
    }

    // Check if token is expired
    const expiresAt = new Date(form.token_expires_at)
    if (expiresAt < new Date()) {
      // Update status to expired
      await supabase
        .from(TABLES.REGISTRATION_FORMS)
        .update({ status: 'expired' })
        .eq('id', form.id)

      return NextResponse.json(
        { success: false, error: 'This form link has expired' },
        { status: 410 }
      )
    }

    // Check if already completed
    if (form.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'This form has already been submitted' },
        { status: 410 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        formId: form.id,
        userId: form.user_id,
        expiresAt: form.token_expires_at,
        user: form.user_profiles,
      },
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error fetching registration form:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * POST /api/registration-form/[token]
 * Submit registration form data
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = getSupabaseAdminClient()

    const { token } = await context.params
    const formData = await request.json()

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Fetch form by token
    const { data: form, error: formError } = await supabase
      .from(TABLES.REGISTRATION_FORMS)
      .select('id, user_id, token_expires_at, status')
      .eq('form_token', token)
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired form link' },
        { status: 404 }
      )
    }

    // Check if token is expired
    const expiresAt = new Date(form.token_expires_at)
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This form link has expired' },
        { status: 410 }
      )
    }

    // Check if already completed
    if (form.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'This form has already been submitted' },
        { status: 410 }
      )
    }

    // Get request metadata
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Update registration form with submission data
    const { error: updateError } = await supabase
      .from(TABLES.REGISTRATION_FORMS)
      .update({
        full_name_nric: formData.fullNameNric,
        residential_address: formData.residentialAddress,
        postal_code: formData.postalCode,
        date_of_birth: formData.dateOfBirth,
        email: formData.email,
        phone: formData.phone,
        blood_group: formData.bloodGroup,
        emergency_contact: formData.emergencyContact,
        emergency_contact_phone: formData.emergencyContactPhone,
        parent_guardian_name: formData.parentGuardianName || null,
        parent_guardian_signature: formData.parentGuardianSignature || null,
        parent_guardian_date: formData.parentGuardianDate || null,
        member_signature: formData.memberSignature,
        member_signature_date: new Date().toISOString(),
        terms_accepted: formData.termsAccepted || false,
        media_consent: formData.mediaConsent || false,
        status: 'completed',
        form_completed_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', form.id)

    if (updateError) {
      console.error('Error updating form:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to submit form' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Update user profile with form reference and additional data
    const { error: profileError } = await supabase
      .from(TABLES.USER_PROFILES)
      .update({
        registration_form_id: form.id,
        date_of_birth: formData.dateOfBirth,
        phone: formData.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', form.user_id)

    if (profileError) {
      console.error('Error updating user profile:', profileError)
      // Don't fail the request if profile update fails
    }

    // Send email with PDF attachment
    try {
      // Get user details for email
      const { data: userProfile } = await supabase
        .from(TABLES.USER_PROFILES)
        .select('email, name')
        .eq('id', form.user_id)
        .single()

      if (userProfile?.email) {
        const { getWebAppUrl } = await import('@/lib/email-url')
        const webAppUrl = getWebAppUrl()

        // Request PDF generation and email sending from web app
        await fetch(`${webAppUrl}/api/registration-form/send-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            userEmail: userProfile.email,
            userName: userProfile.name,
            memberSignatureDate: new Date().toISOString(),
            submittedAt: new Date().toISOString(),
          }),
        })
        console.log('[Registration Form] PDF email sent to', userProfile.email)
      }
    } catch (emailError) {
      console.error('[Registration Form] Failed to send PDF email:', emailError)
      // Don't fail the form submission if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Registration form submitted successfully',
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error submitting registration form:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
