import { NextRequest, NextResponse } from 'next/server'

/**
 * CORS Middleware for API Routes
 * Handles CORS preflight and actual requests from the web app
 */
export function middleware(request: NextRequest) {
  // Only handle API routes
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Get the origin from the request
  const origin = request.headers.get('origin')
  
  // Allowed origins (add your production domain here)
  const allowedOrigins = [
    'http://localhost:3001', // Web app dev
    'http://localhost:3000', // Admin app (same origin)
    process.env.NEXT_PUBLIC_WEB_APP_URL, // Web app production
  ].filter(Boolean) as string[]

  // Check if origin is allowed
  const isAllowedOrigin = origin && allowedOrigins.includes(origin)

  // Handle preflight requests (OPTIONS)
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 })
    
    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Max-Age', '86400') // 24 hours
    
    return response
  }

  // Handle actual requests - add CORS headers to response
  const response = NextResponse.next()

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}

