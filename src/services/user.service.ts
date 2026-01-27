import { getSupabaseAdminClient } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'
import { createAuditLog, requirePermission, requireRole } from './rbac.service'
import type {
  UserProfile,
  UserProfileWithStats,
  UserStats,
  UserRole,
  CreateUserProfileRequest,
  UpdateUserProfileRequest,
  UpdateUserRoleRequest,
  UpdateUserStatusRequest,
  UserListQuery,
  UserListResponse,
} from '@/api/schemas'

// =====================================================
// HELPER: Convert DB row to UserProfile
// =====================================================

function toUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    phone: row.phone as string | null,
    avatarUrl: row.avatar_url as string | null,
    role: row.role as UserRole,
    isActive: row.is_active as boolean,
    noShowCount: row.no_show_count as number,
    isFlagged: row.is_flagged as boolean,
    preferences: (row.preferences as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    dateOfBirth: row.date_of_birth as string | null,
    gender: row.gender as string | null,
    bloodGroup: row.blood_group as string | null,
    physicalFormUrl: row.physical_form_url as string | null,
    registrationFormId: row.registration_form_id as string | null,
    registrationFormSentAt: row.registration_form_sent_at as string | null,
    earlyBirdEligible: (row.early_bird_eligible as boolean) || false,
    earlyBirdGrantedAt: row.early_bird_granted_at as string | null,
    earlyBirdExpiresAt: row.early_bird_expires_at as string | null,
  }
}

function toUserStats(row: Record<string, unknown>): UserStats {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    totalClassesAttended: row.total_classes_attended as number,
    totalClassesBooked: row.total_classes_booked as number,
    totalNoShows: row.total_no_shows as number,
    totalLateCancels: row.total_late_cancels as number,
    totalTokensPurchased: row.total_tokens_purchased as number,
    totalTokensUsed: row.total_tokens_used as number,
    totalSpentCents: row.total_spent_cents as number,
    favoriteClassType: row.favorite_class_type as string | null,
    favoriteInstructorId: row.favorite_instructor_id as string | null,
    streakCurrent: row.streak_current as number,
    streakLongest: row.streak_longest as number,
    lastClassAt: row.last_class_at as string | null,
    memberSince: row.member_since as string,
    updatedAt: row.updated_at as string,
  }
}

// =====================================================
// GET USER PROFILE - OPTIMIZED: Single query using view
// =====================================================

export async function getUserProfile(
  requesterId: string,
  targetUserId: string
): Promise<UserProfileWithStats> {
  // Check if requesting own profile or has permission
  if (requesterId !== targetUserId) {
    await requirePermission(requesterId, 'users', 'view_all')
  }

  // Use the view for single query
  const { data, error } = await getSupabaseAdminClient()
    .from('user_profiles_with_stats')
    .select('*')
    .eq('id', targetUserId)
    .single()

  if (error || !data) {
    throw new ApiError('NOT_FOUND_ERROR', 'User not found', 404)
  }

  const profile = toUserProfile(data)

  // Stats from the view (already joined)
  const stats: UserStats | undefined = data.total_classes_attended !== null ? {
    id: '',
    userId: data.id as string,
    totalClassesAttended: (data.total_classes_attended as number) || 0,
    totalClassesBooked: (data.total_classes_booked as number) || 0,
    totalNoShows: (data.total_no_shows as number) || 0,
    totalLateCancels: 0,
    totalTokensPurchased: (data.total_tokens_purchased as number) || 0,
    totalTokensUsed: (data.total_tokens_used as number) || 0,
    totalSpentCents: (data.total_spent_cents as number) || 0,
    favoriteClassType: null,
    favoriteInstructorId: null,
    streakCurrent: (data.streak_current as number) || 0,
    streakLongest: (data.streak_longest as number) || 0,
    lastClassAt: data.last_class_at as string | null,
    memberSince: data.created_at as string,
    updatedAt: data.updated_at as string,
  } : undefined

  return {
    ...profile,
    stats,
    currentTokenBalance: (data.current_token_balance as number) || 0,
    currentAvailableTokens: (data.current_available_tokens as number) || 0,
  }
}

// =====================================================
// GET CURRENT USER PROFILE (shorthand for own profile)
// =====================================================

export async function getCurrentUserProfile(userId: string): Promise<UserProfileWithStats> {
  return getUserProfile(userId, userId)
}

// =====================================================
// LIST USERS (Admin only) - OPTIMIZED: Single query using view
// =====================================================

export async function listUsers(
  requesterId: string,
  query: UserListQuery
): Promise<UserListResponse> {
  await requirePermission(requesterId, 'users', 'view_all')

  const { page, pageSize, role, isActive, isFlagged, search, sortBy, sortOrder } = query
  const offset = (page - 1) * pageSize

  // Use the user_profiles_with_stats view for a SINGLE query
  // This view already JOINs user_profiles + user_stats + user_token_balances
  let dbQuery = getSupabaseAdminClient()
    .from('user_profiles_with_stats')
    .select('*', { count: 'exact' })

  // Apply filters
  if (role) {
    dbQuery = dbQuery.eq('role', role)
  }
  if (isActive !== undefined) {
    dbQuery = dbQuery.eq('is_active', isActive)
  }
  if (isFlagged !== undefined) {
    dbQuery = dbQuery.eq('is_flagged', isFlagged)
  }
  if (search) {
    dbQuery = dbQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  // Apply sorting
  const sortColumn = sortBy === 'createdAt' ? 'created_at' : sortBy
  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  // Apply pagination
  dbQuery = dbQuery.range(offset, offset + pageSize - 1)

  const { data, error, count } = await dbQuery

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to fetch users', 500, error)
  }

  const total = count || 0

  // Fetch last_sign_in_at from auth.users for paginated user IDs only
  // OPTIMIZED: Skip this expensive operation for large result sets or make it async
  const userIds = (data || []).map((row: Record<string, unknown>) => row.id as string)
  const lastLoginMap: Record<string, string | null> = {}
  
  // Only fetch last login for small result sets to avoid performance issues
  // For larger sets, skip it (last login is non-critical data)
  if (userIds.length > 0 && userIds.length <= 50) {
    try {
      // Fetch ALL auth users and filter (Supabase Admin API doesn't support filtering by IDs)
      // This is still expensive but acceptable for small result sets
      const { data: authUsersData, error: authError } = await getSupabaseAdminClient().auth.admin.listUsers()
      
      if (!authError && authUsersData?.users) {
        // Create a Set for O(1) lookup instead of O(n) includes()
        const userIdSet = new Set(userIds)
        
        // Filter to only the users we need
        for (const authUser of authUsersData.users) {
          if (userIdSet.has(authUser.id)) {
            lastLoginMap[authUser.id] = authUser.last_sign_in_at || null
          }
        }
      }
    } catch (error) {
      // If fetching last login fails, continue without it (non-critical)
      console.warn('Failed to fetch last login times:', error)
    }
  }
  // For result sets > 50 users, skip last login fetch to maintain performance

  // Map from view data (already has stats + balances) to UserProfile with stats
  const users = (data || []).map((row: Record<string, unknown>) => {
    const profile = toUserProfile(row)
    
    // Stats from the view (already joined)
    const stats: UserStats | undefined = row.total_classes_attended !== null ? {
      id: '', // View doesn't have stats ID
      userId: row.id as string,
      totalClassesAttended: (row.total_classes_attended as number) || 0,
      totalClassesBooked: (row.total_classes_booked as number) || 0,
      totalNoShows: (row.total_no_shows as number) || 0,
      totalLateCancels: 0, // Not in view
      totalTokensPurchased: (row.total_tokens_purchased as number) || 0,
      totalTokensUsed: (row.total_tokens_used as number) || 0,
      totalSpentCents: (row.total_spent_cents as number) || 0,
      favoriteClassType: null, // Not in view
      favoriteInstructorId: null, // Not in view
      streakCurrent: (row.streak_current as number) || 0,
      streakLongest: (row.streak_longest as number) || 0,
      lastClassAt: row.last_class_at as string | null,
      memberSince: row.created_at as string, // Use profile created_at
      updatedAt: row.updated_at as string,
    } : undefined
    
    return {
      ...profile,
      stats,
      currentTokenBalance: (row.current_token_balance as number) || 0,
      currentAvailableTokens: (row.current_available_tokens as number) || 0,
      totalClassesBooked: (row.total_classes_booked as number) || 0,
      totalNoShows: (row.total_no_shows as number) || 0,
      lastLogin: lastLoginMap[row.id as string] || null,
    }
  })

  return {
    users,
    meta: {
      total,
      page,
      pageSize,
      hasMore: offset + (data?.length || 0) < total,
    },
  }
}

// =====================================================
// UPDATE USER PROFILE
// =====================================================

export async function updateUserProfile(
  requesterId: string,
  targetUserId: string,
  updates: UpdateUserProfileRequest
): Promise<UserProfile> {
  // Check if updating own profile or has permission
  if (requesterId !== targetUserId) {
    await requirePermission(requesterId, 'users', 'edit_all')
  }

  // Get current profile for audit log
  const { data: currentData } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('*')
    .eq('id', targetUserId)
    .single()

  if (!currentData) {
    throw new ApiError('NOT_FOUND_ERROR', 'User not found', 404)
  }

  const updateData: Record<string, unknown> = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.phone !== undefined) updateData.phone = updates.phone
  if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl
  if (updates.preferences !== undefined) updateData.preferences = updates.preferences
  // Handle admin-only fields if present (from UpdateUserProfileAdminRequest)
  const adminUpdates = updates as any
  if (adminUpdates.email !== undefined) updateData.email = adminUpdates.email
  if (adminUpdates.dateOfBirth !== undefined) updateData.date_of_birth = adminUpdates.dateOfBirth
  if (adminUpdates.gender !== undefined) updateData.gender = adminUpdates.gender
  if (adminUpdates.bloodGroup !== undefined) updateData.blood_group = adminUpdates.bloodGroup

  const { data, error } = await getSupabaseAdminClient()
    .from('user_profiles')
    .update(updateData)
    .eq('id', targetUserId)
    .select()
    .single()

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to update profile', 500, error)
  }

  // If name was updated, also sync to auth.users metadata
  // (The database trigger does this too, but this ensures immediate effect)
  if (updates.name !== undefined) {
    try {
      await getSupabaseAdminClient().auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          name: updates.name,
          role: data.role, // Keep role in sync
        },
      })
    } catch (metadataError) {
      console.error('[User Service] Failed to sync name to auth metadata:', metadataError)
      // Don't throw - the profile update succeeded
    }
  }

  // Audit log
  await createAuditLog({
    userId: requesterId,
    action: 'user.profile.update',
    resourceType: 'user_profiles',
    resourceId: targetUserId,
    oldValues: currentData as Record<string, unknown>,
    newValues: updateData,
  })

  return toUserProfile(data)
}

// =====================================================
// UPDATE USER ROLE (Super Admin only)
// =====================================================

export async function updateUserRole(
  requesterId: string,
  targetUserId: string,
  updates: UpdateUserRoleRequest
): Promise<UserProfile> {
  await requireRole(requesterId, 'super_admin')

  // Prevent self-demotion
  if (requesterId === targetUserId) {
    throw new ApiError('VALIDATION_ERROR', 'Cannot change your own role', 400)
  }

  // Get current profile for audit log
  const { data: currentData } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('*')
    .eq('id', targetUserId)
    .single()

  if (!currentData) {
    throw new ApiError('NOT_FOUND_ERROR', 'User not found', 404)
  }

  // Update user_profiles (trigger will sync to auth.users metadata)
  const { data, error } = await getSupabaseAdminClient()
    .from('user_profiles')
    .update({ role: updates.role })
    .eq('id', targetUserId)
    .select()
    .single()

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to update user role', 500, error)
  }

  // Also update auth.users metadata directly for immediate effect
  // (The database trigger does this too, but this ensures it happens immediately)
  try {
    await getSupabaseAdminClient().auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        role: updates.role,
        name: data.name,
      },
    })
  } catch (metadataError) {
    console.error('[User Service] Failed to sync role to auth metadata:', metadataError)
    // Don't throw - the profile update succeeded, and the trigger should handle it
  }

  // Audit log
  await createAuditLog({
    userId: requesterId,
    action: 'user.role.change',
    resourceType: 'user_profiles',
    resourceId: targetUserId,
    oldValues: { role: currentData.role },
    newValues: { role: updates.role },
  })

  return toUserProfile(data)
}

// =====================================================
// UPDATE USER STATUS (Admin only)
// =====================================================

export async function updateUserStatus(
  requesterId: string,
  targetUserId: string,
  updates: UpdateUserStatusRequest
): Promise<UserProfile> {
  await requirePermission(requesterId, 'users', 'edit_all')

  // Get current profile for audit log
  const { data: currentData } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('*')
    .eq('id', targetUserId)
    .single()

  if (!currentData) {
    throw new ApiError('NOT_FOUND_ERROR', 'User not found', 404)
  }

  const updateData: Record<string, unknown> = {}
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive
  if (updates.isFlagged !== undefined) updateData.is_flagged = updates.isFlagged

  const { data, error } = await getSupabaseAdminClient()
    .from('user_profiles')
    .update(updateData)
    .eq('id', targetUserId)
    .select()
    .single()

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to update user status', 500, error)
  }

  // Audit log
  await createAuditLog({
    userId: requesterId,
    action: 'user.status.update',
    resourceType: 'user_profiles',
    resourceId: targetUserId,
    oldValues: { is_active: currentData.is_active, is_flagged: currentData.is_flagged },
    newValues: updateData,
  })

  return toUserProfile(data)
}

// =====================================================
// DELETE USER (Super Admin only)
// =====================================================

export async function deleteUser(
  requesterId: string,
  targetUserId: string
): Promise<void> {
  await requireRole(requesterId, 'super_admin')

  // Prevent self-deletion
  if (requesterId === targetUserId) {
    throw new ApiError('VALIDATION_ERROR', 'Cannot delete your own account', 400)
  }

  // Get current profile for audit log
  const { data: currentData } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('*')
    .eq('id', targetUserId)
    .single()

  if (!currentData) {
    throw new ApiError('NOT_FOUND_ERROR', 'User not found', 404)
  }

  // Delete from auth.users (will cascade to user_profiles)
  const { error } = await getSupabaseAdminClient().auth.admin.deleteUser(targetUserId)

  if (error) {
    throw new ApiError('SERVER_ERROR', 'Failed to delete user', 500, error)
  }

  // Audit log
  await createAuditLog({
    userId: requesterId,
    action: 'user.delete',
    resourceType: 'user_profiles',
    resourceId: targetUserId,
    oldValues: currentData as Record<string, unknown>,
  })
}

// =====================================================
// CREATE USER (Admin only - manual user creation)
// =====================================================

export async function createUser(
  requesterId: string,
  data: CreateUserProfileRequest
): Promise<UserProfile> {
  await requirePermission(requesterId, 'users', 'edit_all')

  // Create auth user with role in metadata (this allows immediate auth without DB query)
  const { data: authData, error: authError } = await getSupabaseAdminClient().auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      name: data.name,
      role: data.role,
    },
  })

  if (authError) {
    if (authError.message.includes('already')) {
      throw new ApiError('CONFLICT_ERROR', 'User with this email already exists', 409)
    }
    throw new ApiError('SERVER_ERROR', 'Failed to create user', 500, authError)
  }

  // Wait a moment for the trigger to create the profile
  await new Promise(resolve => setTimeout(resolve, 100))

  // Profile should be created automatically via the on_auth_user_created trigger
  const { data: profileData, error: profileError } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  if (profileError || !profileData) {
    // If profile wasn't created by trigger, create it manually
    const { data: newProfile, error: insertError } = await getSupabaseAdminClient()
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: data.email,
        name: data.name,
        phone: data.phone || null,
        role: data.role,
        date_of_birth: data.dateOfBirth || null,
        blood_group: data.bloodGroup || null,
        physical_form_url: data.physicalFormUrl || null,
      })
      .select()
      .single()

    if (insertError) {
      throw new ApiError('SERVER_ERROR', 'Failed to create user profile', 500, insertError)
    }

    // Audit log
    await createAuditLog({
      userId: requesterId,
      action: 'user.create',
      resourceType: 'user_profiles',
      resourceId: authData.user.id,
      newValues: { email: data.email, name: data.name, role: data.role },
    })

    return toUserProfile(newProfile)
  }

  // If the profile was created by trigger but with wrong role, update it
  if (profileData.role !== data.role || data.dateOfBirth || data.bloodGroup || data.physicalFormUrl) {
    const updateData: Record<string, unknown> = {
      role: data.role,
      name: data.name,
      phone: data.phone || null,
    }
    
    if (data.dateOfBirth) updateData.date_of_birth = data.dateOfBirth
    if (data.bloodGroup) updateData.blood_group = data.bloodGroup
    if (data.physicalFormUrl) updateData.physical_form_url = data.physicalFormUrl
    
    const { data: updatedProfile, error: updateError } = await getSupabaseAdminClient()
      .from('user_profiles')
      .update(updateData)
      .eq('id', authData.user.id)
      .select()
      .single()

    if (!updateError && updatedProfile) {
      // Audit log
      await createAuditLog({
        userId: requesterId,
        action: 'user.create',
        resourceType: 'user_profiles',
        resourceId: authData.user.id,
        newValues: { email: data.email, name: data.name, role: data.role },
      })

      return toUserProfile(updatedProfile)
    }
  }

  // Audit log
  await createAuditLog({
    userId: requesterId,
    action: 'user.create',
    resourceType: 'user_profiles',
    resourceId: authData.user.id,
    newValues: { email: data.email, name: data.name, role: data.role },
  })

  // Send welcome notification to new user (in-app)
  try {
    const { sendNotification } = await import('./notification.service')
    await sendNotification({
      userId: authData.user.id,
      type: 'welcome',
      channel: 'in_app',
      data: {
        user_name: data.name,
        message: `Welcome to Zumbaton, ${data.name}! We're excited to have you. Start exploring classes and book your first session!`,
      },
    })
  } catch (notificationError) {
    console.error('[UserService] Error sending welcome notification:', notificationError)
  }

  // Automatically send registration form email
  try {
    console.log('[UserService] Sending registration form email to:', data.email)
    const registrationFormUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'
    const registrationResponse = await fetch(`${registrationFormUrl}/api/registration-form/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: authData.user.id,
      }),
    })

    if (!registrationResponse.ok) {
      const errorData = await registrationResponse.json()
      console.error('[UserService] Failed to send registration form:', errorData)
    } else {
      console.log('[UserService] Registration form email sent successfully')
    }
  } catch (registrationError) {
    console.error('[UserService] Error sending registration form:', registrationError)
  }

  // Email sending is now handled separately via API endpoint
  // This ensures user creation succeeds even if email fails

  return toUserProfile(profileData)
}

// =====================================================
// UPDATE USER STATS (Internal use)
// =====================================================

export async function incrementUserStat(
  userId: string,
  stat: keyof Omit<UserStats, 'id' | 'userId' | 'memberSince' | 'updatedAt'>,
  amount: number = 1
): Promise<void> {
  const columnMap: Record<string, string> = {
    totalClassesAttended: 'total_classes_attended',
    totalClassesBooked: 'total_classes_booked',
    totalNoShows: 'total_no_shows',
    totalLateCancels: 'total_late_cancels',
    totalTokensPurchased: 'total_tokens_purchased',
    totalTokensUsed: 'total_tokens_used',
    totalSpentCents: 'total_spent_cents',
    streakCurrent: 'streak_current',
    streakLongest: 'streak_longest',
  }

  const column = columnMap[stat]
  if (!column) return

  // Use RPC to increment
  const { error } = await getSupabaseAdminClient().rpc('increment_user_stat', {
    p_user_id: userId,
    p_column: column,
    p_amount: amount,
  })

  // If RPC doesn't exist, fall back to manual update
  if (error) {
    const { data: current } = await getSupabaseAdminClient()
      .from('user_stats')
      .select(column)
      .eq('user_id', userId)
      .single()

    const currentValue = ((current as Record<string, unknown> | null)?.[column] as number) || 0

    await getSupabaseAdminClient()
      .from('user_stats')
      .update({ [column]: currentValue + amount })
      .eq('user_id', userId)
  }
}

export async function updateLastClassAt(userId: string): Promise<void> {
  await getSupabaseAdminClient()
    .from('user_stats')
    .update({ last_class_at: new Date().toISOString() })
    .eq('user_id', userId)
}

/**
 * Calculate and update user streak based on attendance
 * Streak logic:
 * - If last class was yesterday: increment streak
 * - If last class was today: keep streak (already counted)
 * - If last class was more than 1 day ago: reset to 1
 * - Update streak_longest if current exceeds it
 */
export async function updateUserStreak(userId: string, classDate: Date = new Date()): Promise<void> {
  const adminClient = getSupabaseAdminClient()
  
  // Get current user stats
  const { data: stats, error: fetchError } = await adminClient
    .from('user_stats')
    .select('streak_current, streak_longest, last_class_at')
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    console.error('[UserService] Failed to fetch user stats for streak update:', fetchError)
    return
  }

  const currentStreak = stats?.streak_current || 0
  const longestStreak = stats?.streak_longest || 0
  const lastClassAt = stats?.last_class_at ? new Date(stats.last_class_at) : null

  // Normalize dates to start of day for comparison
  const today = new Date(classDate)
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  let newStreak = 1
  let shouldUpdate = true

  if (lastClassAt) {
    const lastClassDate = new Date(lastClassAt)
    lastClassDate.setHours(0, 0, 0, 0)

    if (lastClassDate.getTime() === today.getTime()) {
      // Already attended today - don't increment streak again
      shouldUpdate = false
    } else if (lastClassDate.getTime() === yesterday.getTime()) {
      // Attended yesterday - continue streak
      newStreak = currentStreak + 1
    } else {
      // More than 1 day gap - reset to 1
      newStreak = 1
    }
  } else {
    // First class ever - start streak at 1
    newStreak = 1
  }

  if (shouldUpdate) {
    const newLongestStreak = Math.max(longestStreak, newStreak)

    await adminClient
      .from('user_stats')
      .update({
        streak_current: newStreak,
        streak_longest: newLongestStreak,
        last_class_at: classDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }
}

// =====================================================
// GET USER BY EMAIL
// =====================================================

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from('user_profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (error || !data) {
    return null
  }

  return toUserProfile(data)
}
