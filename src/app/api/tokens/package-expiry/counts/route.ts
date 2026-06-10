// GET /api/tokens/package-expiry/counts
// Tab badge counts only — always in sync with list filters

import { NextResponse } from 'next/server'
import { getPackageExpiryCounts } from '@/lib/token-expiry-utils'

export async function GET() {
  try {
    const counts = await getPackageExpiryCounts()
    return NextResponse.json({ success: true, data: counts })
  } catch (error) {
    console.error('[API /tokens/package-expiry/counts]', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch expiry counts' } },
      { status: 500 }
    )
  }
}
