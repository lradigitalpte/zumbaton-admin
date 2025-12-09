// Class Categories API Route
// CRUD operations for class categories

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'

interface CategoryRow {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  icon: string | null
  parent_id: string | null
  is_active: boolean
  sort_order: number
}

// GET /api/class-categories - List all active categories
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    
    let query = supabase
      .from('class_categories')
      .select('*')
      .order('sort_order', { ascending: true })
    
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('[API /class-categories] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to fetch categories',
        },
      }, { status: 500 })
    }

    const categories = ((data || []) as CategoryRow[]).map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      color: cat.color,
      icon: cat.icon,
      parentId: cat.parent_id,
      isActive: cat.is_active,
      sortOrder: cat.sort_order,
    }))

    return NextResponse.json({
      success: true,
      data: {
        categories,
        total: categories.length,
      },
    })
  } catch (error) {
    console.error('[API /class-categories]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

// POST /api/class-categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const body = await request.json()

    const { name, slug, description, color, icon, parentId } = body

    if (!name || !slug) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category name and slug are required',
        },
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('class_categories')
      .insert({
        name,
        slug,
        description: description || null,
        color: color || '#f59e0b',
        icon: icon || null,
        parent_id: parentId || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[API /class-categories POST] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to create category',
        },
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        category: {
          id: data.id,
          name: data.name,
          slug: data.slug,
          description: data.description,
          color: data.color,
          icon: data.icon,
          parentId: data.parent_id,
          isActive: data.is_active,
          sortOrder: data.sort_order,
        },
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[API /class-categories POST]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}
