import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

interface AdjustTokensParams {
  userId: string
  tokensChange: number
  reason: string
  userPackageId?: string
}

interface AdjustTokensResponse {
  success: boolean
  data: {
    tokensChange: number
    newBalance: number
    transactionId: string
    message: string
  }
}

// Hook to adjust user tokens
export function useAdjustTokens() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (params: AdjustTokensParams) => {
      const response = await api.post<AdjustTokensResponse>('/api/tokens/adjust', {
        userId: params.userId,
        tokensChange: params.tokensChange,
        reason: params.reason,
        userPackageId: params.userPackageId,
      })
      
      if (response.error) {
        throw new Error(response.error.message || "Failed to adjust tokens")
      }
      
      return response.data
    },
    onSuccess: () => {
      // Invalidate and refetch all user-related queries to refresh token balances
      queryClient.invalidateQueries({ queryKey: ['users'], refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['user'], refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['tokens'], refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['staff'], refetchType: 'active' })
    },
  })
}

