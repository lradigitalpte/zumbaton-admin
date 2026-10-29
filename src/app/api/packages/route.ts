// Packages API Route
// Handles package CRUD operations

import { NextRequest, NextResponse } from 'next/server'
import { createPackage, listPackagesWithStats, updatePackage, deactivatePackage, getPackage } from '@/services/package.service'
import { CreatePackageRequestSchema, PackageListQuerySchema, UpdatePackageRequestSchema } from '@/api/schemas'
import { ApiError } from '@/lib/api-error'
import { getAuthenticatedUser } from '@/middleware/rbac'
import { createAuditLog } from '@/services/rbac.service'

// GET /api/packages - List all packages with stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query params
    const query = {
      classType: searchParams.get('classType') || undefined,
      isActive: searchParams.get('isActive') === 'true' ? true : 
                searchParams.get('isActive') === 'false' ? false : undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 100,
    }

    // Validate query
    const validatedQuery = PackageListQuerySchema.parse(query)
    
    // Get packages with stats
    const result = await listPackagesWithStats(validatedQuery)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/packages - Create a new package
export async function POST(request: NextRequest) {
  try {
    // Check authentication and role
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Only admin and super_admin can create packages
    if (!['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can create packages' } },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate request body
    const validatedData = CreatePackageRequestSchema.parse(body)

    // Create package
    const result = await createPackage(validatedData)
    await createAuditLog({
      userId: user.id,
      action: 'package.create',
      resourceType: 'packages',
      resourceId: result.package?.id,
      newValues: {
        name: result.package?.name,
        tokenCount: result.package?.tokenCount,
        priceCents: result.package?.priceCents,
        validityDays: result.package?.validityDays,
      },
    })

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/packages - Update a package
export async function PATCH(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Package ID is required',
        },
      }, { status: 400 })
    }

    const body = await request.json()

    // Validate request body
    const validatedData = UpdatePackageRequestSchema.parse(body)
    const before = await getPackage(id).catch(() => null)

    // Update package
    const result = await updatePackage(id, validatedData)
    await createAuditLog({
      userId: user.id,
      action: validatedData.isActive === false ? 'package.deactivate' : 'package.update',
      resourceType: 'packages',
      resourceId: id,
      oldValues: before?.package ? {
        name: before.package.name,
        tokenCount: before.package.tokenCount,
        priceCents: before.package.priceCents,
        validityDays: before.package.validityDays,
        isActive: before.package.isActive,
      } : undefined,
      newValues: validatedData as Record<string, unknown>,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/packages - Deactivate a package (soft delete)
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Package ID is required',
        },
      }, { status: 400 })
    }

    // Deactivate package
    const result = await deactivatePackage(id)
    await createAuditLog({
      userId: user.id,
      action: 'package.deactivate',
      resourceType: 'packages',
      resourceId: id,
      newValues: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// Error handler helper
function handleApiError(error: unknown) {
  console.error('[API /packages]', error)

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
