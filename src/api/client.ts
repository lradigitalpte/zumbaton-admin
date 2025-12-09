import { ZodSchema } from 'zod'
import {
  ApiError,
  ApiResponse,
  createErrorResponse,
  createSuccessResponse,
  getRetryDelay,
  shouldRetry,
} from '@/lib/api-error'

export interface ApiClientConfig {
  baseUrl: string
  timeout?: number
  retries?: number
  cache?: boolean
  cacheTTL?: number
  headers?: Record<string, string>
  onUnauthorized?: () => void
}

export interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  endpoint: string
  data?: unknown
  schema: ZodSchema
  cache?: boolean
  timeout?: number
  headers?: Record<string, string>
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class ApiClient {
  private baseUrl: string
  private timeout: number
  private maxRetries: number
  private cacheEnabled: boolean
  private cacheTTL: number
  private defaultHeaders: Record<string, string>
  private cache: Map<string, CacheEntry<unknown>>
  private onUnauthorized?: () => void
  private pendingRequests: Map<string, Promise<unknown>>

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl
    this.timeout = config.timeout || 30000
    this.maxRetries = config.retries || 3
    this.cacheEnabled = config.cache !== false
    this.cacheTTL = config.cacheTTL || 5 * 60 * 1000
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    }
    this.cache = new Map()
    this.onUnauthorized = config.onUnauthorized
    this.pendingRequests = new Map()
  }

  async request<T>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    try {
      const cacheKey = this.getCacheKey(options)
      const shouldCache = options.cache !== false && options.method === 'GET'

      if (shouldCache && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey) as CacheEntry<T>
        if (Date.now() - cached.timestamp < cached.ttl) {
          return createSuccessResponse(cached.data)
        }
        this.cache.delete(cacheKey)
      }

      if (shouldCache && this.pendingRequests.has(cacheKey)) {
        return (await this.pendingRequests.get(cacheKey)) as ApiResponse<T>
      }

      const requestPromise = this.executeRequest<T>(options)

      if (shouldCache) {
        this.pendingRequests.set(cacheKey, requestPromise)
      }

      const response = await requestPromise

      if (shouldCache && response.success) {
        this.cache.set(cacheKey, {
          data: response.data as T,
          timestamp: Date.now(),
          ttl: options.timeout || this.cacheTTL,
        })
      }

      if (shouldCache) {
        this.pendingRequests.delete(cacheKey)
      }

      return response
    } catch (error) {
      return createErrorResponse(error as Error)
    }
  }

  private async executeRequest<T>(
    options: ApiRequestOptions,
    attempt: number = 1
  ): Promise<ApiResponse<T>> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout || this.timeout
      )

      const url = `${this.baseUrl}${options.endpoint}`
      const headers = { ...this.defaultHeaders, ...options.headers }

      const fetchOptions: RequestInit = {
        method: options.method,
        headers,
        signal: controller.signal,
      }

      if (options.data && options.method !== 'GET') {
        fetchOptions.body = JSON.stringify(options.data)
      }

      const response = await fetch(url, fetchOptions)
      clearTimeout(timeoutId)

      const contentType = response.headers.get('content-type')
      let body: unknown

      if (contentType?.includes('application/json')) {
        body = await response.json()
      } else {
        body = await response.text()
      }

      if (!response.ok) {
        if (response.status === 401) {
          this.onUnauthorized?.()
        }

        const error = ApiError.fromHttpStatus(response.status)
        throw error
      }

      if (!Array.isArray(body) && typeof body === 'object' && body !== null) {
        const bodyObj = body as Record<string, unknown>
        if ('success' in bodyObj && !bodyObj.success && 'error' in bodyObj) {
          const errorObj = bodyObj.error as Record<string, unknown> | undefined
          const errorCode = (errorObj?.code as string) || 'SERVER_ERROR'
          const validCodes = ['VALIDATION_ERROR', 'AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 'NOT_FOUND_ERROR', 'CONFLICT_ERROR', 'RATE_LIMIT_ERROR', 'SERVER_ERROR', 'NETWORK_ERROR', 'TIMEOUT_ERROR', 'UNKNOWN_ERROR']
          throw new ApiError(
            validCodes.includes(errorCode) ? errorCode as 'SERVER_ERROR' : 'SERVER_ERROR',
            (errorObj?.message as string) || 'Server returned an error',
            response.status,
            errorObj?.details
          )
        }
      }

      const validationResult = options.schema.safeParse(body)

      if (!validationResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Response validation failed',
          500,
          validationResult.error.errors
        )
      }

      return createSuccessResponse(validationResult.data as T)
    } catch (error) {
      if (error instanceof ApiError) {
        if (shouldRetry(error) && attempt <= this.maxRetries) {
          const delay = getRetryDelay(attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return this.executeRequest<T>(options, attempt + 1)
        }
        throw error
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('TIMEOUT_ERROR', 'Request timeout', 408)
        }

        if (error.message.includes('fetch')) {
          throw new ApiError('NETWORK_ERROR', 'Network request failed', 0)
        }
      }

      throw error
    }
  }

  private getCacheKey(options: ApiRequestOptions): string {
    const params = options.data ? JSON.stringify(options.data) : ''
    return `${options.method}:${options.endpoint}:${params}`
  }

  clearCache(): void {
    this.cache.clear()
  }

  clearCacheEntry(endpoint: string, method: string = 'GET'): void {
    const keysToDelete: string[] = []
    this.cache.forEach((_, key) => {
      if (key.includes(endpoint) && key.startsWith(method)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach((key) => this.cache.delete(key))
  }

  setAuthHeader(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  removeAuthHeader(): void {
    delete this.defaultHeaders['Authorization']
  }
}
