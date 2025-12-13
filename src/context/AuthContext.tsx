'use client'

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
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

const PUBLIC_ROUTES = ['/signin', '/signup', '/forgot-password', '/set-password', '/mfa', '/reset-password']
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
    return {
      id: supabaseUser.id,
      name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
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
  return {
    id: supabaseUser.id,
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
    email: supabaseUser.email || '',
    role: 'user',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingTooLong, setLoadingTooLong] = useState(false)
  const hasInitializedRef = useRef(false)
  const isInitializingRef = useRef(false)

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
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('[Auth] Session error:', error.message)
        setUser(null)
        setIsLoading(false)
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
        
        if (appRole && ADMIN_ROLES.includes(appRole as User['role'])) {
          console.log('[Auth] ✓ Found admin role in app_metadata:', appRole)
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            role: appRole as User['role'],
          })
          return
        }
        
        if (userRole && ADMIN_ROLES.includes(userRole as User['role'])) {
          console.log('[Auth] ✓ Found admin role in user_metadata:', userRole)
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            role: userRole as User['role'],
          })
          return
        }
        
        // Fall back to database lookup
        const userData = await mapSupabaseUserToUser(session.user)
        
        console.log('[Auth] Mapped user data:', userData ? { role: userData.role, email: userData.email } : 'null')
        
        if (userData && ADMIN_ROLES.includes(userData.role)) {
          console.log('[Auth] ✓ User has admin role, setting user state')
          setUser(userData)
        } else {
          console.warn('[Auth] ✗ User does NOT have admin role:', userData?.role)
          console.warn('[Auth] Admin roles are:', ADMIN_ROLES)
          // User doesn't have admin role - just set user to null
          // Don't sign out automatically to prevent loops
          setUser(null)
        }
      } else {
        console.log('[Auth] No session found')
        setUser(null)
      }
    } catch (error) {
      console.error('[Auth] Initialization failed:', error)
      setUser(null)
    } finally {
      console.log('[Auth] Auth initialization complete')
      setIsLoading(false)
      isInitializingRef.current = false
    }
  }

  useEffect(() => {
    // Prevent multiple initializations - check both refs
    if (hasInitializedRef.current || isInitializingRef.current) {
      console.log('[Auth] Effect: Already initialized or initializing, skipping...')
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
          console.warn('[Auth] Auth initialization timed out after', AUTH_TIMEOUT, 'ms')
          setIsLoading(false)
          isInitializingRef.current = false
        }
      }, AUTH_TIMEOUT)

      try {
        await initializeAuth()
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
      
      // Sign out from Supabase (this clears the session)
      // Don't await this - redirect immediately to prevent hanging
      supabase.auth.signOut().catch((error) => {
        console.error('[Auth] Sign out error:', error)
      })
      
      // Redirect immediately without waiting - the redirect will clear everything
      window.location.href = '/signin'
    } catch (error) {
      console.error('[Auth] Sign out error:', error)
      // Clear state even on error
      setUser(null)
      setIsLoading(false)
      setLoadingTooLong(false)
      hasInitializedRef.current = false
      isInitializingRef.current = false
      // Even if there's an error, force redirect to clear state
      window.location.href = '/signin'
    }
  }

  // Route protection - REMOVED to prevent loops
  // Route protection should be handled at the page/layout level, not here
  // This prevents infinite redirect loops

  // Show loading spinner while checking auth
  if (isLoading) {
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
