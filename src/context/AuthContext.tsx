'use client'

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { supabase, getSupabaseClient } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { refreshSessionIfNeeded, isSessionValid } from '@/lib/session'

interface User {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'admin' | 'instructor' | 'staff' | 'receptionist' | 'user'
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: User['role'] }>
  signOut: () => Promise<void>
  checkSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PUBLIC_ROUTES = ['/signin', '/signup', '/forgot-password', '/set-password', '/mfa', '/reset-password', '/']
const ADMIN_ROLES: User['role'][] = ['super_admin', 'admin', 'instructor', 'staff', 'receptionist']
const AUTH_TIMEOUT = 10000 // 10 seconds max for auth check

// Map Supabase user to User
async function mapSupabaseUserToUser(supabaseUser: SupabaseUser | null): Promise<User | null> {
  if (!supabaseUser) return null

  // First, check user_metadata for role (this is faster and doesn't need RLS)
  const metadataRole = supabaseUser.user_metadata?.role
  
  if (metadataRole && ADMIN_ROLES.includes(metadataRole as User['role'])) {
    
    // Extract user name with better formatting
    let userName = 'User'
    if (supabaseUser.user_metadata?.name) {
      userName = supabaseUser.user_metadata.name
    } else if (supabaseUser.email) {
      const emailName = supabaseUser.email.split('@')[0]
      userName = emailName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }
    
    return {
      id: supabaseUser.id,
      name: userName,
      email: supabaseUser.email || '',
      role: metadataRole as User['role'],
    }
  }

  // Try to fetch from user_profiles table with timeout
  try {
    const client = getSupabaseClient()
    
    // Add a timeout to prevent hanging (RLS can cause circular dependency)
    const profilePromise = client
      .from('user_profiles')
      .select('id, email, name, role')
      .eq('id', supabaseUser.id)
      .maybeSingle()
    
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), 3000)
    )
    
    try {
      const result = await Promise.race([profilePromise, timeoutPromise]) as { data: any; error: any } | null
      
      if (!result) {
        // Timeout reached
        return null
      }
      
      const { data: profile, error } = result

      if (error) {
        console.error('[Auth] Error fetching user profile:', error.message, error.code)
      } else if (profile) {
        
        const profileRole = profile.role as User['role']
        return {
          id: profile.id,
          name: profile.name || supabaseUser.email?.split('@')[0] || 'User',
          email: profile.email || supabaseUser.email || '',
          role: profileRole,
        }
      }
    } catch (fetchError) {
      // Silently handle fetch errors
    }
  } catch (error) {
    console.error('[Auth] Exception in profile fetch:', error)
  }
  
  // Extract user name with better formatting
  let userName = 'User'
  if (supabaseUser.user_metadata?.name) {
    userName = supabaseUser.user_metadata.name
  } else if (supabaseUser.email) {
    const emailName = supabaseUser.email.split('@')[0]
    userName = emailName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  
  return {
    id: supabaseUser.id,
    name: userName,
    email: supabaseUser.email || '',
    role: 'user',
  }
}

// Helper to get auth token with timeout
async function getAuthTokenWithTimeout(timeoutMs: number = 3000): Promise<string | null> {
  try {
    const sessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Token fetch timed out')), timeoutMs)
    )

    try {
      const result = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: any }; error: any }
      if (result?.data?.session?.access_token) {
        return result.data.session.access_token
      }
      return null
    } catch {
      return null
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingTooLong, setLoadingTooLong] = useState(false)
  const hasInitializedRef = useRef(false)
  const isInitializingRef = useRef(false)
  
  // Check if current route is a public route
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route))

  const initializeAuth = async () => {
    // Prevent multiple simultaneous calls
    if (isInitializingRef.current) {
      return
    }
    
    isInitializingRef.current = true
    setIsLoading(true)
    try {
      // Wrap getSession in a timeout to prevent hanging
      let sessionResult: Awaited<ReturnType<typeof supabase.auth.getSession>>
      try {
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Session check timed out')), 2000)
        )
        sessionResult = await Promise.race([sessionPromise, timeoutPromise])
      } catch (timeoutError) {
        // Treat timeout as "no session" - complete auth immediately
        console.error('[Auth] Session check timed out:', timeoutError)
        setUser(null)
        setIsLoading(false)
        isInitializingRef.current = false
        return
      }
      const { data: { session }, error } = sessionResult

      if (error) {
        console.error('[Auth] Session error:', error.message)
        setUser(null)
        setIsLoading(false)
        isInitializingRef.current = false
        return
      }

      console.log('[Auth] Session result:', session ? `User: ${session.user?.email}` : 'No session')

      if (session?.user) {
        console.log('[Auth] Session found, mapping user...')
        
        // First check app_metadata (set by Supabase admin) or user_metadata
        const appRole = session.user.app_metadata?.role
        const userRole = session.user.user_metadata?.role
        console.log('[Auth] Checking metadata roles:', { appRole, userRole })
        console.log('[Auth] User metadata name:', session.user.user_metadata?.name)
        
        // Helper function to extract user name - use metadata directly, no formatting delays
        const getUserName = (): string => {
          // Try user_metadata.name first - use it directly if available
          const metadataName = session.user.user_metadata?.name
          if (metadataName) {
            console.log('[Auth] Found name in user_metadata:', metadataName)
            return metadataName as string
          }
          // Try email and extract username part
          if (session.user.email) {
            const emailName = session.user.email.split('@')[0]
            // Capitalize first letter and replace underscores with spaces
            return emailName
              .split('_')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ')
          }
          // Fallback based on role
          if (appRole || userRole) {
            const role = (appRole || userRole) as string
            return role.split('_').map((word: string) => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')
          }
          return 'User'
        }
        
        if (appRole && ADMIN_ROLES.includes(appRole as User['role'])) {
          const userName = getUserName()
          setUser({
            id: session.user.id,
            name: userName,
            email: session.user.email || '',
            role: appRole as User['role'],
          })
          setIsLoading(false)
          isInitializingRef.current = false
          return
        }
        
        if (userRole && ADMIN_ROLES.includes(userRole as User['role'])) {
          const userName = getUserName()
          setUser({
            id: session.user.id,
            name: userName,
            email: session.user.email || '',
            role: userRole as User['role'],
          })
          setIsLoading(false)
          isInitializingRef.current = false
          return
        }
        
        // Fall back to database lookup with timeout (only if role not in metadata)
        try {
          // Wrap mapSupabaseUserToUser with explicit timeout
          const userDataPromise = mapSupabaseUserToUser(session.user)
          const dbTimeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => {
              console.warn('[Auth] Database lookup timed out, skipping')
              resolve(null)
            }, 2000)
          )
          
          const userData = await Promise.race([userDataPromise, dbTimeoutPromise])
          
          if (userData && ADMIN_ROLES.includes(userData.role)) {
            setUser(userData)
            setIsLoading(false)
            isInitializingRef.current = false
            return
          } else {
            // Either no data or not an admin - either way, can't authenticate
            setUser(null)
            setIsLoading(false)
            isInitializingRef.current = false
            return
          }
        } catch (dbError) {
          console.error('[Auth] Database lookup failed:', dbError)
          // If database lookup fails, we can't verify admin role
          // Set user to null so they get redirected to signin
          setUser(null)
          setIsLoading(false)
          isInitializingRef.current = false
          return
        }
      } else {
        setUser(null)
        setIsLoading(false)
        isInitializingRef.current = false
        return
      }
    } catch (error) {
      console.error('[Auth] Initialization failed:', error)
      setUser(null)
      setIsLoading(false)
      isInitializingRef.current = false
      return // Exit early on error
    } finally {
      // Only run if we didn't return early
      if (isInitializingRef.current) {
        console.log('[Auth] Auth initialization complete (finally block)')
        setIsLoading(false)
        isInitializingRef.current = false
      }
    }
  }

  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | undefined

    // Prevent duplicate initialization
    if (hasInitializedRef.current) {
      console.log('[Auth] useEffect: Already initialized, skipping')
      return
    }

    hasInitializedRef.current = true

    const doInitialize = async () => {
      try {
        console.log('[Auth] useEffect: Starting initialization')
        
        // Set a hard timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn('[Auth] useEffect: Hard timeout - forcing completion')
            setIsLoading(false)
            isInitializingRef.current = false
          }
        }, 8000) // 8 second hard timeout

        // Call initialization function
        await initializeAuth()
        
        if (isMounted) {
          console.log('[Auth] useEffect: Initialization complete')
          setIsLoading(false)
        }
      } catch (error) {
        console.error('[Auth] useEffect: Initialization error:', error)
        if (isMounted) {
          setIsLoading(false)
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        isInitializingRef.current = false
      }
    }

    // Start initialization immediately
    doInitialize()

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          const userData = await mapSupabaseUserToUser(session.user)
          if (userData && ADMIN_ROLES.includes(userData.role)) {
            setUser(userData)
            setIsLoading(false)
          } else {
            setUser(null)
            setIsLoading(false)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          const userData = await mapSupabaseUserToUser(session.user)
          if (userData && ADMIN_ROLES.includes(userData.role)) {
            setUser(userData)
          }
        }
      }
    )

    // Cleanup
    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
      // Don't reset hasInitializedRef here - we want to prevent re-initialization
    }
  }, []) // Empty dependency array - only run once on mount

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string; role?: User['role'] }> => {
    // Validate input first
    if (!email || !password) {
      return {
        success: false,
        error: 'Please enter both email and password',
      }
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: 'Please enter a valid email address',
      }
    }

    try {
      // Reduced timeout - 10 seconds instead of 15
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Sign in timed out. Please check your internet connection and try again.')), 10000)
      })

      const signInPromise = (async () => {
        // Add timeout to the actual Supabase call
        const supabaseCall = supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        
        const supabaseTimeout = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Supabase request timed out')), 8000)
        )
        
        let data, error
        try {
          const result = await Promise.race([supabaseCall, supabaseTimeout]) as { data: any; error: any }
          data = result.data
          error = result.error
        } catch (timeoutError: any) {
          return {
            success: false,
            error: 'Connection timeout. Please check your internet connection and try again.',
          }
        }

        if (error) {
          // Handle specific error codes
          if (error.status === 400) {
            return {
              success: false,
              error: 'Invalid email or password. Please check your credentials and try again.',
            }
          }
          if (error.status === 429) {
            return {
              success: false,
              error: 'Too many login attempts. Please try again later.',
            }
          }
          if (error.message?.includes('Email not confirmed')) {
            return {
              success: false,
              error: 'Please verify your email address before signing in.',
            }
          }
          return {
            success: false,
            error: error.message || 'Invalid email or password',
          }
        }

        if (!data.user) {
          return {
            success: false,
            error: 'Failed to create session',
          }
        }

        // Check metadata first (fast path - no database query needed)
        const appRole = data.user.app_metadata?.role
        const userRole = data.user.user_metadata?.role

        let finalRole: User['role'] = 'user'
        // Use name from metadata directly if available
        let userName = 'User'
        if (data.user.user_metadata?.name) {
          userName = data.user.user_metadata.name as string
        } else if (data.user.email) {
          userName = data.user.email.split('@')[0]
        }

        if (appRole && ADMIN_ROLES.includes(appRole as User['role'])) {
          finalRole = appRole as User['role']
        } else if (userRole && ADMIN_ROLES.includes(userRole as User['role'])) {
          finalRole = userRole as User['role']
        } else {
          // Fall back to database query (may be slow due to RLS)
          const userData = await mapSupabaseUserToUser(data.user)
          if (userData) {
            finalRole = userData.role
            userName = userData.name
          }
        }

        // Check if user has admin-level role
        if (!ADMIN_ROLES.includes(finalRole)) {
          await supabase.auth.signOut()
          return {
            success: false,
            error: 'Access denied. Admin access required.',
          }
        }

        const userData: User = {
          id: data.user.id,
          email: data.user.email || '',
          name: userName,
          role: finalRole,
        }

        setUser(userData)
        return { success: true, role: finalRole }
      })()

      const result = await Promise.race([signInPromise, timeoutPromise])
      return result
    } catch (error: any) {
      console.error('[Auth] Sign in failed:', error)
      
      // Handle timeout specifically
      if (error?.message?.includes('timed out') || error?.message?.includes('timeout')) {
        return {
          success: false,
          error: 'Sign in timed out. Please check your internet connection and try again.',
        }
      }
      
      // Handle network errors
      if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
        return {
          success: false,
          error: 'Network error. Please check your internet connection and try again.',
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
      }
    }
  }

  const checkSession = async (): Promise<boolean> => {
    try {
      const isValid = await isSessionValid()
      if (isValid) {
        // Refresh session if needed
        await refreshSessionIfNeeded()
        // Re-initialize auth to update user state
        await initializeAuth()
      }
      return isValid
    } catch (error) {
      console.error('[Auth] Error checking session:', error)
      return false
    }
  }

  const signOut = async () => {
    try {
      // Clear user state immediately
      setUser(null)
      setIsLoading(false)
      setLoadingTooLong(false)
      // Reset initialization refs to allow re-initialization on next page load
      hasInitializedRef.current = false
      isInitializingRef.current = false
      
      // Sign out from Supabase (this should clear the session)
      try {
        await supabase.auth.signOut()
      } catch (supabaseError) {
        console.error('[Auth] Supabase sign out error:', supabaseError)
        // Continue even if Supabase signOut fails
      }
      
      // Manually clear all Supabase-related localStorage items
      try {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => {
          localStorage.removeItem(key)
        })
        console.log('[Auth] Cleared', keysToRemove.length, 'localStorage items')
      } catch (storageError) {
        console.error('[Auth] Error clearing localStorage:', storageError)
      }
      
      // Redirect to signin page
      window.location.href = '/signin'
    } catch (error) {
      console.error('[Auth] Sign out error:', error)
      // Clear state even on error
      setUser(null)
      setIsLoading(false)
      setLoadingTooLong(false)
      hasInitializedRef.current = false
      isInitializingRef.current = false
      
      // Manually clear localStorage even on error
      try {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => {
          localStorage.removeItem(key)
        })
      } catch (storageError) {
        console.error('[Auth] Error clearing localStorage on error:', storageError)
      }
      
      // Even if there's an error, force redirect to clear state
      window.location.href = '/signin'
    }
  }

  // Route protection - REMOVED to prevent loops
  // Route protection should be handled at the page/layout level, not here
  // This prevents infinite redirect loops

  // Show loading spinner while checking auth, but allow public routes to render immediately
  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
        {loadingTooLong && (
          <div className="mt-4 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              Loading is taking longer than expected...
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      signOut,
      checkSession,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
