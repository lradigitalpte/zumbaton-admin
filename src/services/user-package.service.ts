// User Package Service
// Handles user package purchases and management

import { supabase, TABLES, isSupabaseError, SUPABASE_ERRORS } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import { getUserTokenBalance } from './token.service'
import type {
  UserPackage,
  UserPackageWithDetails,
  PurchasePackageRequest,
  PurchaseResponse,
  FreezePackageRequest,
  FreezeResponse,
  UserPackagesResponse,
  UserPackagesQuery,
  TokenBalance,
} from '@/api/schemas'

// Purchase a package
export async function purchasePackage(params: {
  userId: string
  packageId: string
  paymentId?: string
}): Promise<PurchaseResponse> {
  const { userId, packageId, paymentId } = params

  // 1. Get package details
  const { data: pkg, error: pkgError } = await supabase
    .from(TABLES.PACKAGES)
    .select('*')
    .eq('id', packageId)
    .eq('is_active', true)
    .single()

  if (pkgError || !pkg) {
    throw new ApiError('NOT_FOUND_ERROR', 'Package not found or not available', 404)
  }

  // 2. Calculate expiry date
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + pkg.validity_days)

  // 3. Create user package
  const { data: userPackage, error: insertError } = await supabase
    .from(TABLES.USER_PACKAGES)
    .insert({
      user_id: userId,
      package_id: packageId,
      tokens_remaining: pkg.token_count,
      tokens_held: 0,
      purchased_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'active',
      payment_id: paymentId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertError) {
    throw new ApiError('SERVER_ERROR', 'Failed to create user package', 500, insertError)
  }

  // 4. Record transaction
  await supabase
    .from(TABLES.TOKEN_TRANSACTIONS)
    .insert({
      user_id: userId,
      user_package_id: userPackage.id,
      transaction_type: 'purchase',
      tokens_change: pkg.token_count,
      tokens_before: 0,
      tokens_after: pkg.token_count,
      description: `Purchased ${pkg.name}`,
      created_at: new Date().toISOString(),
    })

  // 5. Get new balance
  const balance = await getUserTokenBalance(userId)

  return {
    userPackage: mapUserPackageToSchema(userPackage),
    tokensAdded: pkg.token_count,
    newBalance: balance.availableTokens,
    expiresAt: expiresAt.toISOString(),
    message: `Successfully purchased ${pkg.name}. ${pkg.token_count} tokens added.`,
  }
}

// Freeze a package
export async function freezePackage(params: {
  userId: string
  userPackageId: string
  freezeDays: number
}): Promise<FreezeResponse> {
  const { userId, userPackageId, freezeDays } = params

  // 1. Get user package
  const { data: userPackage, error: fetchError } = await supabase
    .from(TABLES.USER_PACKAGES)
    .select('*')
    .eq('id', userPackageId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !userPackage) {
    throw new ApiError('NOT_FOUND_ERROR', 'User package not found', 404)
  }

  if (userPackage.status !== 'active') {
    throw new ApiError('VALIDATION_ERROR', `Cannot freeze package with status: ${userPackage.status}`, 400)
  }

  if (userPackage.frozen_at) {
    throw new ApiError('VALIDATION_ERROR', 'Package has already been frozen once', 400)
  }

  if (userPackage.tokens_held > 0) {
    throw new ApiError('VALIDATION_ERROR', 'Cannot freeze package with held tokens. Cancel your bookings first.', 400)
  }

  // 2. Calculate freeze dates
  const frozenAt = new Date()
  const frozenUntil = new Date()
  frozenUntil.setDate(frozenUntil.getDate() + freezeDays)

  // Extend expiry by freeze duration
  const currentExpiry = new Date(userPackage.expires_at)
  const newExpiry = new Date(currentExpiry)
  newExpiry.setDate(newExpiry.getDate() + freezeDays)

  // 3. Update package
  const { error: updateError } = await supabase
    .from(TABLES.USER_PACKAGES)
    .update({
      status: 'frozen',
      frozen_at: frozenAt.toISOString(),
      frozen_until: frozenUntil.toISOString(),
      expires_at: newExpiry.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userPackageId)

  if (updateError) {
    throw new ApiError('SERVER_ERROR', 'Failed to freeze package', 500, updateError)
  }

  return {
    userPackageId,
    frozenAt: frozenAt.toISOString(),
    frozenUntil: frozenUntil.toISOString(),
    newExpiresAt: newExpiry.toISOString(),
    message: `Package frozen until ${frozenUntil.toLocaleDateString()}. Expiry extended to ${newExpiry.toLocaleDateString()}.`,
  }
}

// Unfreeze a package (manual or scheduled)
export async function unfreezePackage(userPackageId: string): Promise<{
  success: boolean
  message: string
}> {
  const { data: userPackage, error: fetchError } = await supabase
    .from(TABLES.USER_PACKAGES)
    .select('*')
    .eq('id', userPackageId)
    .single()

  if (fetchError || !userPackage) {
    throw new ApiError('NOT_FOUND_ERROR', 'User package not found', 404)
  }

  if (userPackage.status !== 'frozen') {
    throw new ApiError('VALIDATION_ERROR', 'Package is not frozen', 400)
  }

  // Update package
  const { error: updateError } = await supabase
    .from(TABLES.USER_PACKAGES)
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userPackageId)

  if (updateError) {
    throw new ApiError('SERVER_ERROR', 'Failed to unfreeze package', 500, updateError)
  }

  return {
    success: true,
    message: 'Package unfrozen successfully',
  }
}

// Get user's packages with balance
export async function getUserPackages(params: UserPackagesQuery & { userId: string }): Promise<UserPackagesResponse> {
  const { userId, status, page = 1, pageSize = 20 } = params

  let query = supabase
    .from(TABLES.USER_PACKAGES)
    .select(`
      *,
      package:${TABLES.PACKAGES}(*)
    `)
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error } = await query

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch user packages', 500, error)
  }

  const packages = (data || []).map((row: Record<string, unknown>) => ({
    ...mapUserPackageToSchema(row),
    package: row.package ? mapPackageToSchema(row.package as Record<string, unknown>) : undefined,
    tokensAvailable: (row.tokens_remaining as number) - (row.tokens_held as number),
  }))

  const balance = await getUserTokenBalance(userId)

  return {
    packages,
    balance,
  }
}

// Process expired packages (scheduled job)
export async function processExpiredPackages(): Promise<{
  expired: number
  tokensLost: number
}> {
  // Find active packages that have expired
  const { data: expiredPackages } = await supabase
    .from(TABLES.USER_PACKAGES)
    .select('id, user_id, tokens_remaining')
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())

  let expired = 0
  let tokensLost = 0

  for (const pkg of expiredPackages || []) {
    // Update status to expired
    await supabase
      .from(TABLES.USER_PACKAGES)
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('id', pkg.id)

    // Record transaction for expired tokens
    if (pkg.tokens_remaining > 0) {
      await supabase
        .from(TABLES.TOKEN_TRANSACTIONS)
        .insert({
          user_id: pkg.user_id,
          user_package_id: pkg.id,
          transaction_type: 'expire',
          tokens_change: -pkg.tokens_remaining,
          tokens_before: pkg.tokens_remaining,
          tokens_after: 0,
          description: 'Package expired',
          created_at: new Date().toISOString(),
        })

      tokensLost += pkg.tokens_remaining
    }

    expired++
  }

  return { expired, tokensLost }
}

// Process frozen packages that should be unfrozen (scheduled job)
export async function processFrozenPackages(): Promise<{
  unfrozen: number
}> {
  // Find frozen packages where freeze period has ended
  const { data: frozenPackages } = await supabase
    .from(TABLES.USER_PACKAGES)
    .select('id')
    .eq('status', 'frozen')
    .lt('frozen_until', new Date().toISOString())

  let unfrozen = 0

  for (const pkg of frozenPackages || []) {
    try {
      await unfreezePackage(pkg.id)
      unfrozen++
    } catch (err) {
      console.error(`[UserPackageService] Failed to unfreeze package ${pkg.id}:`, err)
    }
  }

  return { unfrozen }
}

// Helper: Map database row to schema
function mapUserPackageToSchema(row: Record<string, unknown>): UserPackage {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    packageId: row.package_id as string,
    tokensRemaining: row.tokens_remaining as number,
    tokensHeld: row.tokens_held as number,
    purchasedAt: row.purchased_at as string,
    expiresAt: row.expires_at as string,
    frozenAt: row.frozen_at as string | null,
    frozenUntil: row.frozen_until as string | null,
    status: row.status as 'active',
    paymentId: row.payment_id as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapPackageToSchema(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    tokenCount: row.token_count as number,
    priceCents: row.price_cents as number,
    currency: row.currency as string,
    validityDays: row.validity_days as number,
    classTypes: row.class_types as ('zumba' | 'yoga' | 'pilates' | 'hiit' | 'spinning' | 'boxing' | 'dance' | 'strength' | 'cardio' | 'all')[],
    packageType: (row.package_type as 'adult' | 'kid' | 'all') || 'adult',
    ageRequirement: (row.age_requirement as 'all' | '5-12' | '13+' | null) || 'all',
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
