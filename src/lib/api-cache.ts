/**
 * Server-side caching utilities for API routes
 * Adds HTTP cache headers to reduce Next.js → Supabase calls
 */

import { NextResponse } from 'next/server'

export type CacheDuration = 
  | 'no-cache'      // No caching
  | 'short'         // 1 minute
  | 'medium'        // 5 minutes  
  | 'long'          // 15 minutes
  | 'very-long'     // 1 hour

const CACHE_DURATIONS: Record<CacheDuration, number> = {
  'no-cache': 0,
  'short': 60,           // 1 minute
  'medium': 5 * 60,      // 5 minutes
  'long': 15 * 60,       // 15 minutes
  'very-long': 60 * 60,  // 1 hour
}

/**
 * Add cache headers to Next.js API response
 * 
 * Usage:
 *   const response = NextResponse.json(data)
 *   return withCache(response, 'medium')
 */
export function withCache(
  response: NextResponse,
  duration: CacheDuration = 'medium',
  options?: {
    public?: boolean
    mustRevalidate?: boolean
  }
): NextResponse {
  const seconds = CACHE_DURATIONS[duration]

  if (seconds === 0) {
    // No caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  }

  // Build Cache-Control header
  const directives: string[] = []
  
  if (options?.public !== false) {
    directives.push('public')
  } else {
    directives.push('private')
  }
  
  directives.push(`max-age=${seconds}`)
  
  if (options?.mustRevalidate !== false) {
    directives.push('must-revalidate')
  }
  
  directives.push('stale-while-revalidate=60') // Serve stale content for 60s while revalidating

  response.headers.set('Cache-Control', directives.join(', '))
  
  // Set Expires header as fallback
  const expiresDate = new Date(Date.now() + seconds * 1000)
  response.headers.set('Expires', expiresDate.toUTCString())

  return response
}

/**
 * Create a cached API response
 * 
 * Usage:
 *   return cachedResponse(data, 'medium')
 */
export function cachedResponse<T>(
  data: T,
  duration: CacheDuration = 'medium',
  status: number = 200,
  options?: {
    public?: boolean
    mustRevalidate?: boolean
  }
): NextResponse {
  const response = NextResponse.json(data, { status })
  return withCache(response, duration, options)
}

/**
 * Cache configuration presets for different data types
 */
export const CACHE_PRESETS = {
  // User data - changes infrequently
  users: 'medium' as CacheDuration,
  
  // Staff/Admin data - changes rarely
  staff: 'medium' as CacheDuration,
  
  // Public data that changes often
  public: 'short' as CacheDuration,
  
  // Static/reference data
  static: 'very-long' as CacheDuration,
  
  // Real-time data - no cache
  realtime: 'no-cache' as CacheDuration,
  
  // Personal/user-specific data
  personal: 'short' as CacheDuration,
}

