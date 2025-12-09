'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

// Create a default query client with caching configuration
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cache data for 30 minutes - admin dashboards don't need real-time data
        staleTime: 30 * 60 * 1000,
        // Keep unused data in cache for 1 hour
        gcTime: 60 * 60 * 1000,
        // Retry failed requests 2 times
        retry: 2,
        // Refetch on window focus disabled - use manual refresh instead
        refetchOnWindowFocus: false,
        // Refetch when internet reconnects
        refetchOnReconnect: true,
        // Refetch on mount only if data is stale
        refetchOnMount: true,
        // Keep previous data visible while refetching (smooth transitions)
        placeholderData: (previousData: unknown) => previousData,
      },
      mutations: {
        // Retry failed mutations once
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: use singleton pattern to keep the same query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  // Use useState to ensure we only create one query client per app instance
  const queryClient = useState(() => getQueryClient())[0]

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

