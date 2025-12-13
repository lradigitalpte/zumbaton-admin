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

  console.log('[Auth] Mapping user:', supabaseUser.id, supabaseUser.email)

  // First, check user_metadata for role (this is faster and doesn't need RLS)
  const metadataRole = supabaseUser.user_metadata?.role
  console.log('[Auth] User metadata role:', metadataRole)
  
  if (metadataRole && ADMIN_ROLES.includes(metadataRole as User['role'])) {
    console.log('[Auth] ✓ Found admin role in user_metadata:', metadataRole)
    
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
    console.log('[Auth] Fetching profile from user_profiles...')
    
    // Add a timeout to prevent hanging (RLS can cause circular dependency)
    let timeoutReached = false
    const timeoutId = setTimeout(() => {
      timeoutReached = true
      console.warn('[Auth] Profile fetch taking too long, will use fallback')
    }, 3000)
    
    try {
      const { data: profile, error } = await client
        .from('user_profiles')
        .select('id, email, name, role')
        .eq('id', supabaseUser.id)
        .maybeSingle()
      
      clearTimeout(timeoutId)
      
      if (timeoutReached) {
        console.warn('[Auth] Profile fetch completed after timeout warning')
      }
      
      console.log('[Auth] Profile query result:', { profile, error: error?.message })

      if (error) {
        console.error('[Auth] Error fetching user profile:', error.message, error.code)
      } else if (profile) {
        console.log('[Auth] ✓ User profile loaded:', { id: profile.id, email: profile.email, role: profile.role })
        
        const profileRole = profile.role as User['role']
        return {
          id: profile.id,
          name: profile.name || supabaseUser.email?.split('@')[0] || 'User',
          email: profile.email || supabaseUser.email || '',
          role: profileRole,
        }
      } else {
        console.warn('[Auth] No profile found in user_profiles table')
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)
      console.warn('[Auth] Profile fetch error:', fetchError)
    }
  } catch (error) {
    console.error('[Auth] Exception in profile fetch:', error)
  }

  // No admin role found anywhere
  console.warn('[Auth] No admin role found, returning user role')
  
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
    console.log('[Auth] Starting auth initialization...')
    setIsLoading(true)
    try {
      console.log('[Auth] Getting session...')
      // Wrap getSession in a timeout to prevent hanging
      let sessionResult: Awaited<ReturnType<typeof supabase.auth.getSession>>
      try {
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Session check timed out')), 2000) // Reduced to 2 seconds
        )
        sessionResult = await Promise.race([sessionPromise, timeoutPromise])
        console.log('[Auth] Session retrieved successfully')
      } catch (timeoutError) {
        console.warn('[Auth] Session check timed out after 2s - treating as no session')
        // Treat timeout as "no session" - complete auth immediately
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
        
        // Don't refresh here - let Supabase auto-refresh handle it
        // Only refresh if explicitly needed (not during initialization)
        
        // First check app_metadata (set by Supabase admin) or user_metadata
        const appRole = session.user.app_metadata?.role
        const userRole = session.user.user_metadata?.role
        console.log('[Auth] Checking metadata roles:', { appRole, userRole })
        
        // Helper function to extract user name
        const getUserName = (): string => {
          // Try user_metadata.name first
          if (session.user.user_metadata?.name) {
            return session.user.user_metadata.name
          }
          // Try email and extract username part
          if (session.user.email) {
            const emailName = session.user.email.split('@')[0]
            // Capitalize first letter and replace underscores with spaces
            return emailName
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
          }
          // Fallback based on role
          if (appRole || userRole) {
            const role = (appRole || userRole) as string
            return role.split('_').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ')
          }
          return 'User'
        }
        
        if (appRole && ADMIN_ROLES.includes(appRole as User['role'])) {
          console.log('[Auth] ✓ Found admin role in app_metadata:', appRole)
          const userName = getUserName()
          console.log('[Auth] Extracted user name:', userName)
          setUser({
            id: session.user.id,
            name: userName,
            email: session.user.email || '',
            role: appRole as User['role'],
          })
          // Complete initialization - don't query database
          setIsLoading(false)
          isInitializingRef.current = false
          console.log('[Auth] Auth complete (from app_metadata)')
          return
        }
        
        if (userRole && ADMIN_ROLES.includes(userRole as User['role'])) {
          console.log('[Auth] ✓ Found admin role in user_metadata:', userRole)
          const userName = getUserName()
          console.log('[Auth] Extracted user name:', userName)
          setUser({
            id: session.user.id,
            name: userName,
            email: session.user.email || '',
            role: userRole as User['role'],
          })
          // Complete initialization - don't query database
          setIsLoading(false)
          isInitializingRef.current = false
          console.log('[Auth] Auth complete (from user_metadata)')
          return
        }
        
        // Fall back to database lookup (only if role not in metadata)
        // But skip this if it's taking too long - use metadata only
        console.log('[Auth] Role not in metadata, trying database lookup...')
        try {
          const userData = await mapSupabaseUserToUser(session.user)
          
          console.log('[Auth] Mapped user data:', userData ? { role: userData.role, email: userData.email } : 'null')
          
          if (userData && ADMIN_ROLES.includes(userData.role)) {
            console.log('[Auth] ✓ User has admin role, setting user state')
            setUser(userData)
            setIsLoading(false)
            isInitializingRef.current = false
            return
          } else {
            console.warn('[Auth] ✗ User does NOT have admin role:', userData?.role)
            console.warn('[Auth] Admin roles are:', ADMIN_ROLES)
            setUser(null)
            setIsLoading(false)
            isInitializingRef.current = false
            return
          }
        } catch (dbError) {
          console.error('[Auth] Database lookup failed or timed out:', dbError)
          // If database lookup fails, we can't verify admin role
          // Set user to null so they get redirected to signin
          setUser(null)
          setIsLoading(false)
          isInitializingRef.current = false
          return
        }
      } else {
        console.log('[Auth] No session found - completing auth')
        setUser(null)
        setIsLoading(false)
        isInitializingRef.current = false
        return // Exit early when no session - don't wait for finally
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
    // Prevent concurrent initializations - only check if currently initializing
    if (isInitializingRef.current) {
      console.log('[Auth] Effect: Already initializing, skipping...')
      return
    }
    
    // If already initialized, skip (normal case after first mount)
    if (hasInitializedRef.current) {
      console.log('[Auth] Effect: Already initialized, skipping...')
      return
    }
    
    // Mark as initializing immediately to prevent race conditions
    hasInitializedRef.current = true
    isInitializingRef.current = true

    let isMounted = true
    let slowLoadingTimeout: NodeJS.Timeout

    const init = async () => {
      // Show "taking too long" message after 5 seconds
      slowLoadingTimeout = setTimeout(() => {
        if (isMounted) {
          setLoadingTooLong(true)
        }
      }, 5000)

      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('[Auth] Auth initialization timed out after', AUTH_TIMEOUT, 'ms - forcing completion')
          setUser(null) // Ensure user is null on timeout
          setIsLoading(false)
          isInitializingRef.current = false
          hasInitializedRef.current = true // Mark as completed (even if failed)
        }
      }, AUTH_TIMEOUT)

      try {
        await initializeAuth()
        // Mark as completed after successful initialization
        hasInitializedRef.current = true
      } finally {
        clearTimeout(timeoutId)
        clearTimeout(slowLoadingTimeout)
        isInitializingRef.current = false
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          const userData = await mapSupabaseUserToUser(session.user)
          if (userData && ADMIN_ROLES.includes(userData.role)) {
            setUser(userData)
            setIsLoading(false)
            setLoadingTooLong(false)
          } else {
            setUser(null)
            setIsLoading(false)
            setLoadingTooLong(false)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsLoading(false)
          setLoadingTooLong(false)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          const userData = await mapSupabaseUserToUser(session.user)
          if (userData && ADMIN_ROLES.includes(userData.role)) {
            setUser(userData)
          }
        }
      }
    )

    // Set up periodic session refresh (every 5 minutes)
    // Use a ref-like approach to check user without causing re-renders
    const refreshInterval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await refreshSessionIfNeeded()
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => {
      isMounted = false
      subscription.unsubscribe()
      clearInterval(refreshInterval)
      // Reset refs on unmount to allow re-initialization
      hasInitializedRef.current = false
      isInitializingRef.current = false
    }
  }, []) // Empty dependency array - only run once on mount

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string; role?: User['role'] }> => {
    console.log('[Auth] Starting sign in for:', email)
    try {
      // Add timeout for the entire sign-in process
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Sign in timed out. Please check your internet connection.')), 15000)
      })

      const signInPromise = (async () => {
        console.log('[Auth] Calling Supabase signInWithPassword...')
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        console.log('[Auth] Sign in response:', { hasData: !!data, hasUser: !!data?.user, error: error?.message })

        if (error) {
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
        console.log('[Auth] Checking roles from metadata:', { appRole, userRole })

        let finalRole: User['role'] = 'user'
        let userName = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User'

        if (appRole && ADMIN_ROLES.includes(appRole as User['role'])) {
          finalRole = appRole as User['role']
          console.log('[Auth] Using role from app_metadata:', finalRole)
        } else if (userRole && ADMIN_ROLES.includes(userRole as User['role'])) {
          finalRole = userRole as User['role']
          console.log('[Auth] Using role from user_metadata:', finalRole)
        } else {
          // Fall back to database query (may be slow due to RLS)
          console.log('[Auth] No role in metadata, trying database...')
          const userData = await mapSupabaseUserToUser(data.user)
          if (userData) {
            finalRole = userData.role
            userName = userData.name
          }
        }

        // Check if user has admin-level role
        if (!ADMIN_ROLES.includes(finalRole)) {
          console.warn('[Auth] User does not have admin role:', finalRole)
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

        console.log('[Auth] ✓ Sign in successful:', { email: userData.email, role: userData.role })
        setUser(userData)
        return { success: true, role: finalRole }
      })()

      return await Promise.race([signInPromise, timeoutPromise])
    } catch (error) {
      console.error('[Auth] Sign in failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
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
