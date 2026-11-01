import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/middleware/rbac'
import { getSystemHealth } from '@/lib/system-health'

/** Same answer for every admin for a few minutes — avoids hammering Supabase / HitPay / the site on Vercel free tier. */
const CACHE_MS = 2 * 60 * 1000
let cached: { at: number; payload: Awaited<ReturnType<typeof getSystemHealth>> } | null = null

async function handleGetSystemHealth(request: NextRequest): Promise<NextResponse> {
  try {
    const fresh = new URL(request.url).searchParams.get('fresh') === '1'
    const now = Date.now()
    if (!fresh && cached && now - cached.at < CACHE_MS) {
      return NextResponse.json({
        success: true,
        data: { ...cached.payload, cachedUntil: new Date(cached.at + CACHE_MS).toISOString() },
      })
    }

    const health = await getSystemHealth()
    cached = { at: now, payload: health }
    return NextResponse.json({ success: true, data: health })
  } catch (error) {
    console.error('[API /settings/job-health]', error)
    return NextResponse.json(
      { success: false, error: { message: 'Could not check the services' } },
      { status: 500 },
    )
  }
}

export const GET = withAuth(handleGetSystemHealth, { requiredRole: 'admin' })
