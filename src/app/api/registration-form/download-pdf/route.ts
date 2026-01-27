/**
 * API Route: Download Registration Form PDF (Admin Side)
 * GET /api/registration-form/download-pdf?formId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getAuthenticatedUser(request)
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const formId = searchParams.get('formId')

    if (!formId) {
      return NextResponse.json(
        { success: false, error: 'Form ID is required' },
        { status: 400 }
      )
    }

    // Fetch form data from admin database
    const supabase = getSupabaseAdminClient()
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
      .eq('id', formId)
      .single()

    if (error || !form) {
      console.error('[Admin Download PDF] Form not found:', error)
      return NextResponse.json(
        { success: false, error: 'Form not found' },
        { status: 404 }
      )
    }

    console.log('[Admin Download PDF] Form fetched:', form.id)

    // Call web app's generate-pdf API with form data
    const isDevelopment = process.env.NODE_ENV === 'development'
    const webAppUrl = isDevelopment ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_WEB_URL || 'https://zumbaton.sg')

    const response = await fetch(`${webAppUrl}/api/registration-form/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Admin Download PDF] Web app error:', errorText)
      return NextResponse.json(
        { success: false, error: 'Failed to generate PDF' },
        { status: 502 }
      )
    }

    const result = await response.json()

    if (!result.success || !result.pdf) {
      console.error('[Admin Download PDF] Invalid response from web app')
      return NextResponse.json(
        { success: false, error: 'Failed to generate PDF' },
        { status: 502 }
      )
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(result.pdf, 'base64')
    const fileName = result.filename || `zumbaton-registration-${form.full_name_nric.replace(/\s+/g, '-')}.pdf`

    // Return PDF as download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[Admin Download PDF] Error:', error)
    console.error('[Admin Download PDF] Stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
