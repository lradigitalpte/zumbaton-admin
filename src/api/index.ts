import { ApiClient } from './client'
import { SignInRequestSchema, SignUpRequestSchema, SignInResponseSchema, SignUpResponseSchema } from './schemas'

// Example setup and usage
const apiClient = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
  retries: 3,
  cache: true,
  cacheTTL: 5 * 60 * 1000,
  onUnauthorized: () => {
    console.log('[API] Unauthorized - redirecting to login')
    window.location.href = '/signin'
  },
})

export { apiClient }

// Example usage in components:
// import { apiClient } from '@/api'
// import { SignInRequestSchema, SignInResponseSchema } from '@/api/schemas'
//
// const response = await apiClient.request({
//   method: 'POST',
//   endpoint: '/auth/signin',
//   data: { email: 'user@example.com', password: 'password123' },
//   schema: SignInResponseSchema,
// })
//
// if (response.success) {
//   const user = response.data.user
//   const token = response.data.tokens.access_token
//   apiClient.setAuthHeader(token)
// } else {
//   console.error(response.error.message)
// }
