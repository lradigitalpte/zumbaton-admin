/**
 * Toast Helper - Unified notification handling for API responses
 * Provides consistent toast messages across the app
 * Adapts to admin app's toast API
 */

// Admin app toast context type
export interface AdminToastContext {
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void
  hideToast: (id: string) => void
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code?: string
    message?: string
  }
  message?: string
}

// Adapter to convert admin toast to standard interface
export function createToastAdapter(toastContext: AdminToastContext): ToastService {
  return {
    success: (title: string, message?: string) => {
      const fullMessage = message ? `${title} - ${message}` : title
      toastContext.showToast(fullMessage, 'success', 4000)
    },
    error: (title: string, message?: string) => {
      const fullMessage = message ? `${title} - ${message}` : title
      toastContext.showToast(fullMessage, 'error', 5000)
    },
    info: (title: string, message?: string) => {
      const fullMessage = message ? `${title} - ${message}` : title
      toastContext.showToast(fullMessage, 'info', 4000)
    }
  }
}

export interface ToastService {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  info?: (title: string, message?: string) => void
}

/**
 * Handle API response and show appropriate toast
 * @param response - API response object
 * @param toast - Toast service instance
 * @param options - Custom messages (optional)
 * @returns The response for chaining
 */
export function handleApiResponse<T = any>(
  response: ApiResponse<T>,
  toast: ToastService,
  options?: {
    successTitle?: string
    successMessage?: string
    errorTitle?: string
    errorMessage?: string
  }
) {
  if (response.success) {
    const title = options?.successTitle || 'Success'
    const message = options?.successMessage || response.message || (response.data as any)?.message || ''
    toast.success(title, message)
  } else {
    const title = options?.errorTitle || 'Error'
    const message = options?.errorMessage || response.error?.message || 'An error occurred'
    toast.error(title, message)
  }
  return response
}

/**
 * Handle batch API response with count feedback
 * @param response - Batch API response
 * @param toast - Toast service instance
 * @param itemCount - Number of items being processed
 * @returns The response for chaining
 */
export function handleBatchResponse<T>(
  response: ApiResponse<T>,
  toast: ToastService,
  itemCount: number
) {
  if (response.success) {
    const itemWord = itemCount === 1 ? 'item' : 'items'
    toast.success(
      'Success',
      `Successfully processed ${itemCount} ${itemWord}`
    )
  } else {
    toast.error(
      'Failed',
      response.error?.message || 'Unable to complete operation'
    )
  }
  return response
}

/**
 * Handle mutation error with consistent formatting
 * @param error - Error object
 * @param toast - Toast service instance
 * @param context - Context for the error (e.g., "booking", "cancellation")
 */
export function handleMutationError(
  error: any,
  toast: ToastService,
  context = 'Operation'
) {
  const message =
    error?.message ||
    error?.error?.message ||
    (typeof error === 'string' ? error : `${context} failed`)

  toast.error(`${context} Failed`, message)
}

/**
 * Show loading toast (returns function to dismiss)
 * Note: Most toasts auto-dismiss, but this documents the pattern
 */
export function showLoadingToast(toast: ToastService, title: string, message?: string) {
  // Most toast implementations don't have explicit loading state
  // This is a placeholder for future enhancement
  return () => {
    // dismiss function
  }
}
