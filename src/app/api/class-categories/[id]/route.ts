// Class Categories API Route - Individual category operations
// PATCH and DELETE operations for a specific category

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

// PATCH /api/class-categories/[id] - Update a category
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdminClient()
    const body = await request.json()
    const { id } = params

    const { name, slug, description, color, icon, parentId, isActive, sortOrder } = body

    // Build update object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug
    if (description !== undefined) updateData.description = description || null
    if (color !== undefined) updateData.color = color
    if (icon !== undefined) updateData.icon = icon
    if (parentId !== undefined) updateData.parent_id = parentId || null
    if (isActive !== undefined) updateData.is_active = isActive
    if (sortOrder !== undefined) updateData.sort_order = sortOrder
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('class_categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API /class-categories PATCH] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to update category',
        },
      }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      }, { status: 404 })
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
    })
  } catch (error) {
    console.error('[API /class-categories PATCH]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

// DELETE /api/class-categories/[id] - Delete a category
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdminClient()
    const { id } = params

    // Check if category is being used by any classes
    const { data: classesUsingCategory, error: checkError } = await supabase
      .from('classes')
      .select('id')
      .eq('category_id', id)
      .limit(1)

    if (checkError) {
      console.error('[API /class-categories DELETE] Check error:', checkError)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to check category usage',
        },
      }, { status: 500 })
    }

    if (classesUsingCategory && classesUsingCategory.length > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot delete category: it is being used by existing classes',
        },
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('class_categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[API /class-categories DELETE] Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to delete category',
        },
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    })
  } catch (error) {
    console.error('[API /class-categories DELETE]', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 })
  }
}

