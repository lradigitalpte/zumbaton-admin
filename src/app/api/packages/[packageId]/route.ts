// Single Package API Route
// Handles operations on a specific package

import { NextRequest, NextResponse } from 'next/server'
import { getPackage, updatePackage, deactivatePackage } from '@/services/package.service'
import { UpdatePackageRequestSchema, UuidSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { getAuthenticatedUser } from '@/middleware/rbac'

interface RouteParams {
  params: Promise<{ packageId: string }>
}

// GET /api/packages/[packageId] - Get a specific package
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { packageId } = await params
    
    // Validate UUID
    UuidSchema.parse(packageId)

    const result = await getPackage(packageId)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/packages/[packageId] - Update a package
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication and role
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Only admin and super_admin can update packages
    if (!['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can update packages' } },
        { status: 403 }
      )
    }

    const { packageId } = await params
    const body = await request.json()

    // Validate UUID
    UuidSchema.parse(packageId)

    // Validate request body
    const validatedData = UpdatePackageRequestSchema.parse(body)

    const result = await updatePackage(packageId, validatedData)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/packages/[packageId] - Deactivate a package (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication and role
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Only admin and super_admin can deactivate packages
    if (!['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can deactivate packages' } },
        { status: 403 }
      )
    }

    const { packageId } = await params

    // Validate UUID
    UuidSchema.parse(packageId)

    await deactivatePackage(packageId)

    return NextResponse.json({
      success: true,
      data: {
        message: 'Package deactivated successfully',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// Error handler helper
function handleApiError(error: unknown) {
  console.error('[API /packages/[packageId]]', error)

  if (error instanceof ApiError) {
    return NextResponse.json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    }, { status: error.statusCode })
  }

  // Zod validation error
  if (error && typeof error === 'object' && 'errors' in error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: (error as { errors: unknown[] }).errors,
      },
    }, { status: 400 })
  }

  return NextResponse.json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  }, { status: 500 })
}
