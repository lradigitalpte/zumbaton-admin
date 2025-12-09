export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'CONFLICT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR'

export interface ApiErrorDetails {
  code: ApiErrorCode
  message: string
  details?: unknown
  statusCode?: number
  timestamp: string
}

export class ApiError extends Error {
  code: ApiErrorCode
  details?: unknown
  statusCode: number
  timestamp: string

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.statusCode = statusCode
    this.timestamp = new Date().toISOString()
    Object.setPrototypeOf(this, ApiError.prototype)
  }

  toJSON(): ApiErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
    }
  }

  static fromHttpStatus(statusCode: number, message?: string): ApiError {
    const defaultMessages: Record<number, string> = {
      400: 'Bad request',
      401: 'Authentication required',
      403: 'Access denied',
      404: 'Resource not found',
      409: 'Conflict',
      429: 'Too many requests',
      500: 'Server error',
      503: 'Service unavailable',
    }

    const errorCodes: Record<number, ApiErrorCode> = {
      400: 'VALIDATION_ERROR',
      401: 'AUTHENTICATION_ERROR',
      403: 'AUTHORIZATION_ERROR',
      404: 'NOT_FOUND_ERROR',
      409: 'CONFLICT_ERROR',
      429: 'RATE_LIMIT_ERROR',
      500: 'SERVER_ERROR',
      503: 'SERVER_ERROR',
    }

    const code = errorCodes[statusCode] || 'UNKNOWN_ERROR'
    const msg = message || defaultMessages[statusCode] || 'Unknown error'

    return new ApiError(code, msg, statusCode)
  }
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiErrorDetails
  timestamp: string
}

export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  }
}

export function createErrorResponse(error: ApiError | Error): ApiResponse<never> {
  const apiError = error instanceof ApiError ? error : new ApiError(
    'UNKNOWN_ERROR',
    error.message || 'An unexpected error occurred'
  )

  return {
    success: false,
    error: apiError.toJSON(),
    timestamp: new Date().toISOString(),
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'An unexpected error occurred'
}

export function shouldRetry(error: ApiError): boolean {
  const retryableCodes: ApiErrorCode[] = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'RATE_LIMIT_ERROR',
    'SERVER_ERROR',
  ]

  const retryableStatuses = [408, 429, 500, 502, 503, 504]

  return (
    retryableCodes.includes(error.code) ||
    Boolean(error.statusCode && retryableStatuses.includes(error.statusCode))
  )
}

export function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
  const jitter = Math.random() * 1000
  const maxDelay = 30000

  return Math.min(exponentialDelay + jitter, maxDelay)
}
