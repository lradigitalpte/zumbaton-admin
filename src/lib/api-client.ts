/**
 * API CLIENT PROTOCOL
 * 
 * ⚠️ MANDATORY: ALL API calls in this project MUST use this API client.
 * 
 * DO NOT use direct fetch() calls. DO NOT manually handle authentication tokens.
 * 
 * Usage:
 *   import { api } from '@/lib/api-client'
 *   
 *   // GET request
 *   const response = await api.get<ResponseType>('/api/users')
 *   if (response.error) { /* handle error *\/ }
 *   const data = response.data
 *   
 *   // POST request
 *   const response = await api.post<ResponseType>('/api/users', { name: 'John' })
 *   
 *   // PUT request
 *   const response = await api.put<ResponseType>('/api/users/123', { name: 'Jane' })
 *   
 *   // DELETE request
 *   const response = await api.delete('/api/users/123')
 * 
 * Features:
 *   - Automatically includes Supabase session token in Authorization header
 *   - Consistent error handling across all API calls
 *   - Type-safe responses with TypeScript generics
 *   - Handles JSON serialization/deserialization
 */

import { supabase } from './supabase'

interface ApiFetchOptions extends RequestInit {
  data?: unknown
  requireAuth?: boolean
}

interface ApiResponse<T = unknown> {
  data?: T
  error?: {
    message: string
    code?: string
    details?: unknown
  }
  success?: boolean
}

/**
 * Make an authenticated API request to a Next.js API route
 * Automatically includes the Supabase session token
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const { data, requireAuth = true, headers, ...fetchOptions } = options

    // Ensure endpoint starts with /
    // Use relative URLs for Next.js API routes (same origin)
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

    // Get session token if auth is required
    let authToken: string | undefined
    if (requireAuth) {
      // Add timeout to session retrieval to prevent hanging
      let sessionData: { data: { session: any }; error: any }
      try {
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session retrieval timed out')), 3000)
        )
        sessionData = await Promise.race([sessionPromise, timeoutPromise]) as any
      } catch (timeoutError) {
        console.error('[API Client] Session retrieval timed out:', timeoutError)
        return {
          error: {
            message: 'Session check timed out',
            code: 'AUTHENTICATION_TIMEOUT',
          },
        }
      }

      const { data: { session }, error: sessionError } = sessionData
      
      if (sessionError) {
        console.error('[API Client] Session error:', sessionError)
        console.error('[API Client] Error details:', JSON.stringify(sessionError, null, 2))
        return {
          error: {
            message: 'Not authenticated',
            code: 'AUTHENTICATION_ERROR',
          },
        }
      }
      
      if (!session) {
        console.error('[API Client] No session found')
        return {
          error: {
            message: 'Not authenticated',
            code: 'AUTHENTICATION_ERROR',
          },
        }
      }
      
      if (!session.access_token) {
        console.error('[API Client] Session exists but no access_token')
        console.error('[API Client] Session data:', { user: session.user?.id, expires_at: session.expires_at })
        return {
          error: {
            message: 'Not authenticated - no access token',
            code: 'AUTHENTICATION_ERROR',
          },
        }
      }
      
      authToken = session.access_token
    }

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string>),
    }

    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`
    }

    // Prepare body
    let body: string | undefined
    if (data && (fetchOptions.method === 'POST' || fetchOptions.method === 'PUT' || fetchOptions.method === 'PATCH' || fetchOptions.method === undefined)) {
      body = JSON.stringify(data)
    }

    // Make the request (using relative URL for same-origin Next.js API routes)
    const response = await fetch(normalizedEndpoint, {
      ...fetchOptions,
      method: fetchOptions.method || 'GET',
      headers: requestHeaders,
      body,
    })

    // Parse response
    const contentType = response.headers.get('content-type')
    let responseData: unknown

    if (contentType?.includes('application/json')) {
      responseData = await response.json()
    } else {
      responseData = await response.text()
    }

    // Handle errors
    if (!response.ok) {
      const errorData = typeof responseData === 'object' && responseData !== null 
        ? responseData as { error?: { message?: string; code?: string }; message?: string }
        : {}

      return {
        error: {
          message: errorData.error?.message || errorData.message || `Request failed with status ${response.status}`,
          code: errorData.error?.code || 'API_ERROR',
        },
      }
    }

    // Return success response
    return {
      success: true,
      data: responseData as T,
    }
  } catch (error) {
    console.error('[API Request Error]', error)
    
    return {
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'NETWORK_ERROR',
      },
    }
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: <T = unknown>(endpoint: string, options?: Omit<ApiFetchOptions, 'method' | 'data'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, data?: unknown, options?: Omit<ApiFetchOptions, 'method' | 'data'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', data }),

  put: <T = unknown>(endpoint: string, data?: unknown, options?: Omit<ApiFetchOptions, 'method' | 'data'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', data }),

  patch: <T = unknown>(endpoint: string, data?: unknown, options?: Omit<ApiFetchOptions, 'method' | 'data'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', data }),

  delete: <T = unknown>(endpoint: string, options?: Omit<ApiFetchOptions, 'method' | 'data'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
}

