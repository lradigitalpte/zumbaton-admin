import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Supabase client singleton
let supabaseClient: SupabaseClient | null = null

// Get environment variables
function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}

// Create Supabase client (singleton)
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig()

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })

  return supabaseClient
}

// Create Supabase client for server-side (with service role)
// IMPORTANT: This should ONLY be used in server-side code (API routes, server components, server actions)
export function getSupabaseAdminClient(): SupabaseClient {
  // Check if we're on the server
  if (typeof window !== 'undefined') {
    throw new Error(
      'getSupabaseAdminClient() can only be called on the server-side. ' +
      'Service role key must never be exposed to the client.'
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase admin environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    )
  }

  // Check if service role key is still a placeholder
  if (supabaseServiceKey === 'your_supabase_service_role_key' || supabaseServiceKey.startsWith('your_')) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is still set to a placeholder value.\n' +
      'Please update it with your actual service role key from the Supabase dashboard:\n' +
      '1. Go to https://supabase.com/dashboard/project/[your-project]/settings/api\n' +
      '2. Copy the "service_role" key (NOT the anon key)\n' +
      '3. Paste it into .env.local as SUPABASE_SERVICE_ROLE_KEY=...\n' +
      '4. Restart your development server'
    )
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Export default client (client-safe)
export const supabase = getSupabaseClient()

// Note: supabaseAdmin is NOT exported as a constant to prevent client-side access
// Use getSupabaseAdminClient() function in server-side code only

// Database table names (aligned with TOKEN_ENGINE_PLAN.md)
export const TABLES = {
  USER_PROFILES: 'user_profiles',
  PACKAGES: 'packages',
  USER_PACKAGES: 'user_packages',
  CLASSES: 'classes',
  BOOKINGS: 'bookings',
  ATTENDANCES: 'attendances',
  TOKEN_TRANSACTIONS: 'token_transactions',
  TOKEN_ADJUSTMENTS: 'token_adjustments',
  WAITLIST: 'waitlist',
  ATTENDANCE_ISSUES: 'attendance_issues',
  PAYMENTS: 'payments',
  AUDIT_LOGS: 'audit_logs',
} as const

// Supabase error codes
export const SUPABASE_ERRORS = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
} as const

// Helper to check if error is a specific Supabase error
export function isSupabaseError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}
