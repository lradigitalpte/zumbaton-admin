// Token Engine Service
// Handles all token-related operations with Supabase
// All operations are server-side only for security

import { supabase, getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { getUsablePackageExpiryCutoff } from '@/lib/token-expiry-utils'
import { isPackageCompatibleWithClass } from '@/lib/user-age-utils'
import { ApiError } from '@/lib/api-error'
import type {
  TokenBalance,
  TokenTransaction,
  TransactionType,
} from '@/api/schemas'

// Token selection strategy
export type TokenSelectionStrategy = 'oldest-first' | 'expiring-first'

interface TokenOperationResult {
  success: boolean
  userPackageId: string | null
  tokensChange: number
  newBalance: number
  transactionId: string | undefined
}

interface ChargeBookingTokensParams {
  userId: string
  tokensNeeded: number
  /** Class age group ('adult' | 'kid' | 'all') used to pick a compatible package. */
  ageGroup?: string | null
  strategy?: TokenSelectionStrategy
}

interface RefundBookingTokensParams {
  userId: string
  userPackageId: string
  bookingId: string | null
  tokensToRefund: number
  description?: string
  performedBy?: string
}

interface RecordBookingChargesParams {
  userId: string
  userPackageId: string
  tokensBefore: number
  charges: { bookingId: string; tokens: number; description: string }[]
}

// Get user's available token balance
// If adminClient is provided, uses admin client (bypasses RLS), otherwise uses regular client
export async function getUserTokenBalance(
  userId: string,
  adminClient?: ReturnType<typeof getSupabaseAdminClient>
): Promise<TokenBalance> {
  const client = adminClient || supabase
  const expiryCutoff = getUsablePackageExpiryCutoff()

  const { data: packages, error } = await client
    .from(TABLES.USER_PACKAGES)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('expires_at', expiryCutoff)
    .order('expires_at', { ascending: true })

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch token balance', 500, error)
  }

  const userPackages = packages || []
  
  let totalTokens = 0
  let heldTokens = 0
  let expiringTokens = 0
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  for (const pkg of userPackages) {
    totalTokens += pkg.tokens_remaining
    heldTokens += pkg.tokens_held
    
    if (new Date(pkg.expires_at) <= sevenDaysFromNow) {
      expiringTokens += pkg.tokens_remaining - pkg.tokens_held
    }
  }

  return {
    userId,
    totalTokens,
    heldTokens,
    availableTokens: totalTokens - heldTokens,
    nextExpiry: userPackages.length > 0 ? userPackages[0].expires_at : null,
    expiringTokens,
    activePackages: userPackages.length,
  }
}

// Get packages that can pay for a booking, best candidate first
async function getAvailablePackages(
  userId: string,
  ageGroup?: string | null,
  strategy: TokenSelectionStrategy = 'expiring-first'
): Promise<Record<string, any>[]> {
  const adminClient = getSupabaseAdminClient()
  const expiryCutoff = getUsablePackageExpiryCutoff()

  let query = adminClient
    .from(TABLES.USER_PACKAGES)
    .select(`
      *,
      package:packages(package_type)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('expires_at', expiryCutoff)
    .gt('tokens_remaining', 0)

  if (strategy === 'expiring-first') {
    query = query.order('expires_at', { ascending: true })
  } else {
    query = query.order('purchased_at', { ascending: true })
  }

  const { data, error } = await query

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch packages', 500, error)
  }

  return (data || []).filter((pkg) => {
    const available = (pkg.tokens_remaining || 0) - (pkg.tokens_held || 0)
    const packageType = (pkg.package as { package_type?: string } | null)?.package_type || 'adult'
    return available > 0 && isPackageCompatibleWithClass(packageType, ageGroup)
  })
}

// Deduct tokens when a booking is made. Tokens are spent at booking time;
// cancelling by 23:59 the day before the class refunds them.
// The ledger rows are written by recordBookingCharges once the booking rows exist.
export async function chargeTokensForBooking(params: ChargeBookingTokensParams): Promise<{
  userPackageId: string
  tokensBefore: number
  tokensAfter: number
}> {
  const { userId, tokensNeeded, ageGroup, strategy } = params
  const adminClient = getSupabaseAdminClient()

  const packages = await getAvailablePackages(userId, ageGroup, strategy)
  const candidates = packages.filter(
    (pkg) => (pkg.tokens_remaining || 0) - (pkg.tokens_held || 0) >= tokensNeeded
  )

  if (candidates.length === 0) {
    throw new ApiError('VALIDATION_ERROR', 'Insufficient tokens available', 400)
  }

  for (const pkg of candidates) {
    const tokensBefore = pkg.tokens_remaining as number
    const tokensAfter = tokensBefore - tokensNeeded

    // Optimistic lock: only succeeds if nobody else changed the balance meanwhile
    const { data, error } = await adminClient
      .from(TABLES.USER_PACKAGES)
      .update({
        tokens_remaining: tokensAfter,
        status: tokensAfter <= 0 ? 'depleted' : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', pkg.id)
      .eq('tokens_remaining', tokensBefore)
      .select('id')

    if (error) {
      throw new ApiError('SERVER_ERROR', 'Failed to charge tokens', 500, error)
    }

    if (data && data.length > 0) {
      return { userPackageId: pkg.id as string, tokensBefore, tokensAfter }
    }
  }

  throw new ApiError('CONFLICT_ERROR', 'Your token balance changed while booking. Please try again.', 409)
}

// Write one 'booking-consume' ledger row per booking charged by chargeTokensForBooking
export async function recordBookingCharges(params: RecordBookingChargesParams): Promise<void> {
  let balance = params.tokensBefore
  for (const charge of params.charges) {
    await recordTransaction({
      userId: params.userId,
      userPackageId: params.userPackageId,
      bookingId: charge.bookingId,
      transactionType: 'booking-consume',
      tokensChange: -charge.tokens,
      tokensBefore: balance,
      tokensAfter: balance - charge.tokens,
      description: charge.description,
    })
    balance -= charge.tokens
  }
}

// Give tokens back to the package a booking was paid from.
// Pass recordLedger: false only to undo a charge whose ledger row was never written
// (booking insert failed right after chargeTokensForBooking).
export async function refundBookingTokens(
  params: RefundBookingTokensParams & { recordLedger?: boolean }
): Promise<TokenOperationResult> {
  const { userId, userPackageId, bookingId, tokensToRefund, description, performedBy, recordLedger = true } = params
  const adminClient = getSupabaseAdminClient()

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: pkg, error: fetchError } = await adminClient
      .from(TABLES.USER_PACKAGES)
      .select('id, tokens_remaining, status, expires_at')
      .eq('id', userPackageId)
      .single()

    if (fetchError || !pkg) {
      throw new ApiError('NOT_FOUND_ERROR', 'User package not found', 404)
    }

    const tokensBefore = pkg.tokens_remaining as number
    const tokensAfter = tokensBefore + tokensToRefund
    // A depleted package becomes usable again; an expired one stays expired
    const isExpired = pkg.status === 'expired' || new Date(pkg.expires_at as string) < new Date()

    const { data: updated, error: updateError } = await adminClient
      .from(TABLES.USER_PACKAGES)
      .update({
        tokens_remaining: tokensAfter,
        status: isExpired ? pkg.status : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userPackageId)
      .eq('tokens_remaining', tokensBefore)
      .select('id')

    if (updateError) {
      throw new ApiError('SERVER_ERROR', 'Failed to refund tokens', 500, updateError)
    }
    if (!updated || updated.length === 0) continue // balance changed underneath us, retry

    const transaction = recordLedger
      ? await recordTransaction({
          userId,
          userPackageId,
          bookingId,
          transactionType: 'refund',
          tokensChange: tokensToRefund,
          tokensBefore,
          tokensAfter,
          description: description || `Tokens refunded for cancelled booking ${bookingId}`,
          performedBy,
        })
      : undefined

    const balance = await getUserTokenBalance(userId, adminClient)

    return {
      success: true,
      userPackageId,
      tokensChange: tokensToRefund,
      newBalance: balance.availableTokens,
      transactionId: transaction?.id,
    }
  }

  throw new ApiError('CONFLICT_ERROR', 'Token balance changed during refund. Please try again.', 409)
}

// Record a token transaction (audit log)
async function recordTransaction(params: {
  userId: string
  userPackageId: string | null
  bookingId?: string | null
  transactionType: TransactionType
  tokensChange: number
  tokensBefore: number
  tokensAfter: number
  description?: string
  performedBy?: string
}): Promise<TokenTransaction> {
  // Validate performedBy is a UUID or null
  const isValidUUID = params.performedBy ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.performedBy) : true
  const performedByValue = isValidUUID ? (params.performedBy || null) : null

  // Use admin client to bypass RLS policies for system operations
  const adminClient = getSupabaseAdminClient()
  
  const { data, error } = await adminClient
    .from(TABLES.TOKEN_TRANSACTIONS)
    .insert({
      user_id: params.userId,
      user_package_id: params.userPackageId,
      booking_id: params.bookingId || null,
      transaction_type: params.transactionType,
      tokens_change: params.tokensChange,
      tokens_before: params.tokensBefore,
      tokens_after: params.tokensAfter,
      description: params.description || null,
      performed_by: performedByValue,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    // Log error but don't fail the main operation — the token balance itself
    // was already updated by this point, only the audit-log entry is missing.
    console.error('[TokenService] Failed to record transaction:', error)
    void alertAdminsOfFailedTransactionLog({
      userId: params.userId,
      transactionType: params.transactionType,
      tokensChange: params.tokensChange,
      description: params.description,
    })
    // Return a mock transaction for now
    return {
      id: 'pending',
      userId: params.userId,
      userPackageId: params.userPackageId,
      bookingId: params.bookingId || null,
      transactionType: params.transactionType,
      tokensChange: params.tokensChange,
      tokensBefore: params.tokensBefore,
      tokensAfter: params.tokensAfter,
      description: params.description || null,
      performedBy: params.performedBy || null,
      createdAt: new Date().toISOString(),
    }
  }

  return {
    id: data.id,
    userId: data.user_id,
    userPackageId: data.user_package_id,
    bookingId: data.booking_id,
    transactionType: data.transaction_type,
    tokensChange: data.tokens_change,
    tokensBefore: data.tokens_before,
    tokensAfter: data.tokens_after,
    description: data.description,
    performedBy: data.performed_by,
    createdAt: data.created_at,
  }
}

// Notify admins when a token audit-log entry fails to write, so a gap in the
// trail is visible in the admin notification bell instead of only server logs.
async function alertAdminsOfFailedTransactionLog(params: {
  userId: string
  transactionType: string
  tokensChange: number
  description?: string
}): Promise<void> {
  try {
    const adminClient = getSupabaseAdminClient()
    const { data: admins } = await adminClient
      .from('user_profiles')
      .select('id')
      .in('role', ['admin', 'super_admin'])

    if (!admins || admins.length === 0) return

    const { sendNotification } = await import('./notification.service')
    const sign = params.tokensChange > 0 ? '+' : ''
    const body = `A token transaction (${params.transactionType}, ${sign}${params.tokensChange}) for user ${params.userId} was applied but its audit-log entry failed to save.${params.description ? ` ${params.description}` : ''} The token balance itself is correct — only this trail entry is missing. Check server logs for details.`

    for (const admin of admins) {
      await sendNotification({
        userId: admin.id,
        type: 'general',
        channel: 'in_app',
        subject: 'Token audit log write failed',
        body,
        data: {},
      })
    }
  } catch (notifyError) {
    console.error('[TokenService] Failed to alert admins of transaction log failure:', notifyError)
  }
}

// Admin: Adjust tokens manually
export async function adminAdjustTokens(params: {
  userId: string
  userPackageId?: string
  tokensChange: number
  reason: string
  performedBy: string
  expiryDays?: number // Expiry duration in days for new adjustment packages
}): Promise<TokenOperationResult> {
  const { userId, userPackageId, tokensChange, reason, performedBy, expiryDays = 365 } = params

  // Use admin client for server-side admin operations
  const adminClient = getSupabaseAdminClient()

  let targetPackageId = userPackageId
  let isNewPackage = false

  // If no package specified, find an active one or create adjustment
  if (!targetPackageId) {
    // Use admin client to find packages
    const expiryCutoff = getUsablePackageExpiryCutoff()
    const { data: packages, error: packagesError } = await adminClient
      .from(TABLES.USER_PACKAGES)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('expires_at', expiryCutoff)
      .gt('tokens_remaining', 0)
      .order('expires_at', { ascending: true })
      .limit(1)
    
    if (!packagesError && packages && packages.length > 0) {
      targetPackageId = packages[0].id
    } else if (tokensChange > 0) {
      // Create a new adjustment package - package already has the correct tokens
      const expiryDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
      const { data: newPkg, error: createError } = await adminClient
        .from(TABLES.USER_PACKAGES)
        .insert({
          user_id: userId,
          package_id: null, // adjustment package
          tokens_remaining: tokensChange,
          tokens_held: 0,
          purchased_at: new Date().toISOString(),
          expires_at: expiryDate.toISOString(),
          status: 'active',
          payment_id: `admin-adjustment-${Date.now()}`,
        })
        .select()
        .single()

      if (createError) {
        throw new ApiError('SERVER_ERROR', 'Failed to create adjustment package', 500, createError)
      }

      targetPackageId = newPkg.id
      isNewPackage = true
    } else {
      throw new ApiError('VALIDATION_ERROR', 'No package to deduct tokens from', 400)
    }
  }

  // Get current package state
  const { data: pkg, error: fetchError } = await adminClient
    .from(TABLES.USER_PACKAGES)
    .select('*')
    .eq('id', targetPackageId)
    .single()

  if (fetchError || !pkg) {
    throw new ApiError('NOT_FOUND_ERROR', 'User package not found', 404)
  }

  // If this is a new package, it already has the correct tokens, so don't add again
  // If it's an existing package, add the tokensChange to the current balance
  const newRemaining = isNewPackage ? pkg.tokens_remaining : pkg.tokens_remaining + tokensChange

  if (newRemaining < 0) {
    throw new ApiError('VALIDATION_ERROR', 'Cannot reduce tokens below zero', 400)
  }

  // Only update if it's not a new package (new packages already have correct tokens)
  if (!isNewPackage) {
    // Update package
    const { error: updateError } = await adminClient
      .from(TABLES.USER_PACKAGES)
      .update({
        tokens_remaining: newRemaining,
        status: newRemaining <= 0 ? 'depleted' : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetPackageId)

    if (updateError) {
      throw new ApiError('SERVER_ERROR', 'Failed to adjust tokens', 500, updateError)
    }
  }

  // Record transaction using admin client
  // tokens_before should be 0 for new packages, or pkg.tokens_remaining for existing packages before adjustment
  const tokensBefore = isNewPackage ? 0 : (pkg.tokens_remaining - tokensChange)
  const { data: transactionData, error: transactionError } = await adminClient
    .from(TABLES.TOKEN_TRANSACTIONS)
    .insert({
      user_id: userId,
      user_package_id: targetPackageId!,
      booking_id: null,
      transaction_type: 'admin-adjust',
      tokens_change: tokensChange,
      tokens_before: tokensBefore,
      tokens_after: newRemaining,
      description: `Admin adjustment: ${reason}`,
      performed_by: performedBy,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()
  
  if (transactionError) {
    console.error('[TokenService] Failed to record transaction:', transactionError)
  }
  
  const transaction = transactionData || {
    id: 'pending',
    user_id: userId,
    user_package_id: targetPackageId!,
    booking_id: null,
    transaction_type: 'admin-adjust',
    tokens_change: tokensChange,
    tokens_before: tokensBefore,
    tokens_after: newRemaining,
    description: `Admin adjustment: ${reason}`,
    performed_by: performedBy,
    created_at: new Date().toISOString(),
  }

  // Get new balance using admin client to ensure we see the updated data immediately
  // For new packages, we can calculate balance directly since we know the package was just created
  let newBalance: number
  if (isNewPackage) {
    // New package was just created with tokensChange tokens, so balance is tokensChange
    newBalance = tokensChange
    console.log('[TokenService] New package created, balance:', newBalance)
  } else {
    // For existing packages, fetch the actual balance
    const balance = await getUserTokenBalance(userId, adminClient)
    newBalance = balance.availableTokens
    console.log('[TokenService] Existing package updated, balance:', newBalance)
  }

  // Send email notification to user about token adjustment
  try {
    const { data: userProfile } = await adminClient
      .from('user_profiles')
      .select('email, name')
      .eq('id', userId)
      .single()

    if (userProfile?.email && userProfile?.name) {
      // Get admin name who performed the adjustment
      const { data: adminProfile } = await adminClient
        .from('user_profiles')
        .select('name')
        .eq('id', performedBy)
        .single()

      const { getWebAppUrl } = await import('@/lib/email-url')
      const webAppUrl = getWebAppUrl()
      const emailApiSecret = process.env.EMAIL_API_SECRET || 'change-me-in-production'

      await fetch(`${webAppUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'token-adjustment',
          secret: emailApiSecret,
          data: {
            userEmail: userProfile.email,
            userName: userProfile.name,
            tokensChange,
            newBalance,
            reason,
            adjustedBy: adminProfile?.name,
          },
        }),
      })
      console.log(`[TokenService] Token adjustment email sent to ${userProfile.email}`)
    }
  } catch (emailError) {
    console.error('[TokenService] Failed to send token adjustment email:', emailError)
    // Don't fail token adjustment if email fails
  }

  return {
    success: true,
    userPackageId: targetPackageId!,
    tokensChange,
    newBalance,
    transactionId: transaction.id || transactionData?.id || 'pending',
  }
}

// Check if user can book a class
export async function canBookClass(
  userId: string,
  tokenCost: number = 1
): Promise<{
  canBook: boolean
  availableTokens: number
  requiredTokens: number
  bestPackageId: string | null
  reason: string | null
}> {
  const balance = await getUserTokenBalance(userId)
  const packages = await getAvailablePackages(userId)
  const bestPackage = packages.length > 0 ? packages[0] : null

  return {
    canBook: balance.availableTokens >= tokenCost,
    availableTokens: balance.availableTokens,
    requiredTokens: tokenCost,
    bestPackageId: bestPackage?.id || null,
    reason: balance.availableTokens < tokenCost ? 'insufficient_tokens' : null,
  }
}

// Get token transaction history
export async function getTokenTransactions(params: {
  userId: string
  transactionType?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}): Promise<{
  transactions: TokenTransaction[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}> {
  const { userId, transactionType, startDate, endDate, page = 1, pageSize = 20 } = params

  const adminClient = getSupabaseAdminClient()

  let query = adminClient
    .from(TABLES.TOKEN_TRANSACTIONS)
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (transactionType) {
    query = query.eq('transaction_type', transactionType)
  }

  if (startDate) {
    query = query.gte('created_at', startDate)
  }

  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch transactions', 500, error)
  }

  const transactions = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    userId: row.user_id as string,
    userPackageId: row.user_package_id as string | null,
    bookingId: row.booking_id as string | null,
    transactionType: row.transaction_type as TransactionType,
    tokensChange: row.tokens_change as number,
    tokensBefore: row.tokens_before as number,
    tokensAfter: row.tokens_after as number,
    description: row.description as string | null,
    performedBy: row.performed_by as string | null,
    createdAt: row.created_at as string,
  }))

  return {
    transactions,
    total: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > page * pageSize,
  }
}
