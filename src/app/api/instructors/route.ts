// Instructors API Route
// Fetches all active instructors for class assignment

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'

interface InstructorRow {
  id: string
  name: string
  email: string
  avatar_url: string | null
  is_active: boolean
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, name, email, avatar_url, is_active')
      .eq('role', 'instructor')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('[API /instructors] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to fetch instructors',
        },
      }, { status: 500 })
    }

    const instructors = ((data || []) as InstructorRow[]).map((instructor) => ({
      id: instructor.id,
      name: instructor.name,
      email: instructor.email,
      avatarUrl: instructor.avatar_url,
    }))

    return NextResponse.json({
      success: true,
      data: {
        instructors,
        total: instructors.length,
      },
    })
  } catch (error) {
    console.error('[API /instructors]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}
