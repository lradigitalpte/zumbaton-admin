// POST /api/tokens/process-expired
// Admin: mark past-due packages as expired and zero remaining tokens

import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/middleware/rbac'
import { processExpiredPackages } from '@/services/user-package.service'
import { ApiError } from '@/lib/api-error'

async function handleProcessExpired(
  _request: Request,
  _context: { params: Promise<Record<string, unknown>>; user: AuthenticatedUser }
) {
  try {
    const result = await processExpiredPackages()
    return NextResponse.json({
      success: true,
      data: result,
      message:
        result.expired === 0
          ? 'No packages needed expiry cleanup'
          : `Marked ${result.expired} package(s) expired (${result.tokensLost} tokens cleared)`,
    })
  } catch (error) {
    console.error('[API /tokens/process-expired]', error)

    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to process expired packages' } },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleProcessExpired, { requiredRole: 'admin' })
