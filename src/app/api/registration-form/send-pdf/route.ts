/**
 * API Route: Send Registration Form PDF via Email (Admin Side)
 * POST /api/registration-form/send-pdf
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export async function POST(request: NextRequest) {
  console.log('[Admin Send PDF] API called')
  
  try {
    // Check authentication
    const user = await getAuthenticatedUser(request)
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    console.log('[Admin Send PDF] Request body:', { formId: body.formId, includeAdminCopy: body.includeAdminCopy, adminEmail: body.adminEmail })

    if (!body.formId) {
      return NextResponse.json(
        { success: false, error: 'Form ID is required' },
        { status: 400 }
      )
    }

    // Fetch form data from database (both apps use same DB)
    const supabase = getSupabaseAdminClient()
    console.log('[Admin Send PDF] Fetching form from database...')
    
    const { data: form, error } = await supabase
      .from(TABLES.REGISTRATION_FORMS)
      .select(`
        *,
        user:user_profiles!user_id (
          id,
          name,
          email
        )
      `)
      .eq('id', body.formId)
      .single()

    if (error || !form) {
      console.error('[Admin Send PDF] Form not found:', error)
      return NextResponse.json(
        { success: false, error: 'Form not found' },
        { status: 404 }
      )
    }

    console.log('[Admin Send PDF] Form fetched:', form.id)
    console.log('[Admin Send PDF] User email:', form.email)

    // Determine web app URL based on environment
    const isDevelopment = process.env.NODE_ENV === 'development'
    const webAppUrl = isDevelopment ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_WEB_URL || 'https://zumbaton.sg')
    console.log('[Admin Send PDF] Environment:', process.env.NODE_ENV)
    console.log('[Admin Send PDF] Calling web app at:', webAppUrl)

    const response = await fetch(`${webAppUrl}/api/registration-form/send-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Send the full form data, not just formId
        userEmail: form.email,
        userName: form.user?.name || form.full_name_nric,
        fullNameNric: form.full_name_nric,
        residentialAddress: form.residential_address,
        postalCode: form.postal_code,
        dateOfBirth: form.date_of_birth,
        email: form.email,
        phone: form.phone,
        bloodGroup: form.blood_group,
        emergencyContact: form.emergency_contact,
        emergencyContactPhone: form.emergency_contact_phone,
        parentGuardianName: form.parent_guardian_name || '',
        parentGuardianSignature: form.parent_guardian_signature || '',
        parentGuardianDate: form.parent_guardian_date || '',
        memberSignature: form.member_signature,
        memberSignatureDate: form.member_signature_date || new Date().toISOString(),
        termsAccepted: form.terms_accepted || false,
        mediaConsent: form.media_consent || false,
        staffSignature: form.staff_signature || '',
        staffName: form.staff_name || '',
        staffSignatureDate: form.staff_signature_date || '',
        submittedAt: form.form_completed_at || form.created_at,
        // Include admin email for copy
        includeAdminCopy: body.includeAdminCopy,
        adminEmail: body.adminEmail,
      }),
    })

    console.log('[Admin Send PDF] Response status:', response.status, response.statusText)

    // Check if response has content
    const responseText = await response.text()
    console.log('[Admin Send PDF] Response body:', responseText.substring(0, 500))
    
    if (!responseText) {
      console.error('[Admin Send PDF] Empty response from web app')
      return NextResponse.json(
        { success: false, error: 'Empty response from web app' },
        { status: 502 }
      )
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseErr) {
      console.error('[Admin Send PDF] Failed to parse JSON:', parseErr)
      console.error('[Admin Send PDF] Response was:', responseText.substring(0, 200))
      return NextResponse.json(
        { success: false, error: 'Invalid response from web app: ' + responseText.substring(0, 100) },
        { status: 502 }
      )
    }

    if (!response.ok || !result.success) {
      console.error('[Admin Send PDF] Web app returned error:', result.error)
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send email' },
        { status: response.status }
      )
    }

    console.log('[Admin Send PDF] Email sent successfully')
    console.log('[Admin Send PDF] Sent to user:', form.email)
    if (body.includeAdminCopy && body.adminEmail) {
      console.log('[Admin Send PDF] Sent copy to admin:', body.adminEmail)
    }

    return NextResponse.json({
      success: true,
      message: 'PDF sent successfully',
    })
  } catch (error) {
    console.error('[Admin Send PDF] Unexpected error:', error)
    console.error('[Admin Send PDF] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send PDF: ' + (error instanceof Error ? error.message : 'Unknown error')
      },
      { status: 500 }
    )
  }
}
