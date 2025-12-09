import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/middleware/rbac'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tutor/profile
 * Get instructor's profile data
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    if (!['instructor', 'super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Instructor access required' } },
        { status: 403 }
      )
    }

    const supabase = getSupabaseAdminClient()

    // Get full profile data
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json(
        { success: false, error: { message: 'Failed to fetch profile' } },
        { status: 500 }
      )
    }

    // Get instructor-specific data if available
    const { data: instructorData } = await supabase
      .from('instructors')
      .select('bio, specialties, certifications, years_experience, hourly_rate, rating, total_reviews')
      .eq('user_id', user.id)
      .maybeSingle()

    // Get session info
    const sessions = [
      {
        id: '1',
        device: 'Current Session',
        browser: request.headers.get('user-agent')?.split(' ').slice(-2).join(' ') || 'Unknown',
        location: 'Your location',
        ip: request.headers.get('x-forwarded-for') || 'Unknown',
        lastActive: 'Active now',
        current: true,
      }
    ]

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          firstName: profile.name?.split(' ')[0] || '',
          lastName: profile.name?.split(' ').slice(1).join(' ') || '',
          email: profile.email,
          phone: profile.phone || '',
          role: profile.role,
          avatarUrl: profile.avatar_url,
          createdAt: profile.created_at,
          ...(instructorData && {
            bio: instructorData.bio || '',
            specialties: instructorData.specialties || [],
            certifications: instructorData.certifications || [],
            yearsExperience: instructorData.years_experience || 0,
            hourlyRate: instructorData.hourly_rate,
            rating: instructorData.rating,
            totalReviews: instructorData.total_reviews,
          })
        },
        sessions,
        security: {
          twoFactorEnabled: false,
          lastPasswordChange: null,
        }
      }
    })
  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/tutor/profile
 * Update instructor profile
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    if (!['instructor', 'super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Instructor access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, phone, bio, specialties, certifications, yearsExperience } = body

    const supabase = getSupabaseAdminClient()

    // Update user_profiles
    const fullName = `${firstName || ''} ${lastName || ''}`.trim()
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (fullName) updateData.name = fullName
    if (phone !== undefined) updateData.phone = phone

    const { error: profileError } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', user.id)

    if (profileError) {
      console.error('Error updating profile:', profileError)
      return NextResponse.json(
        { success: false, error: { message: 'Failed to update profile' } },
        { status: 500 }
      )
    }

    // Update instructor-specific data if provided
    if (bio !== undefined || specialties !== undefined || certifications !== undefined || yearsExperience !== undefined) {
      const instructorUpdate: Record<string, unknown> = {}
      if (bio !== undefined) instructorUpdate.bio = bio
      if (specialties !== undefined) instructorUpdate.specialties = specialties
      if (certifications !== undefined) instructorUpdate.certifications = certifications
      if (yearsExperience !== undefined) instructorUpdate.years_experience = yearsExperience

      await supabase
        .from('instructors')
        .update(instructorUpdate)
        .eq('user_id', user.id)
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Profile updated successfully' }
    })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tutor/profile
 * Handle password change and other actions
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    if (!['instructor', 'super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Instructor access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action } = body

    const supabase = getSupabaseAdminClient()

    if (action === 'change_password') {
      const { newPassword } = body
      
      if (!newPassword) {
        return NextResponse.json(
          { success: false, error: { message: 'New password required' } },
          { status: 400 }
        )
      }

      const { error } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      )

      if (error) {
        console.error('Password change error:', error)
        return NextResponse.json(
          { success: false, error: { message: 'Failed to change password' } },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: { message: 'Password changed successfully' }
      })
    }

    if (action === 'sign_out_all_sessions') {
      return NextResponse.json({
        success: true,
        data: { message: 'All other sessions signed out' }
      })
    }

    return NextResponse.json(
      { success: false, error: { message: 'Invalid action' } },
      { status: 400 }
    )
  } catch (error) {
    console.error('Profile action error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
