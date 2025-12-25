/**
 * Promotion Service
 * Handles referral discounts (8%) and early bird discounts (15%)
 */

import { getSupabaseAdminClient, TABLES } from '@/lib/supabase'
import { ApiError } from '@/lib/api-error'

export interface PromoEligibility {
  hasReferralDiscount: boolean
  hasEarlyBirdDiscount: boolean
  referralDiscountPercent: number
  earlyBirdDiscountPercent: number
  totalDiscountPercent: number
  maxDiscountPercent: number // Can only use one promo at a time
}

export interface AppliedDiscount {
  discountPercent: number
  discountAmountCents: number
  originalAmountCents: number
  finalAmountCents: number
  promoType: 'referral' | 'early_bird' | null
}

/**
 * Check if user is eligible for referral discount (8% off next package)
 * Conditions:
 * - User was referred by someone
 * - User hasn't used their referral discount yet
 * - Referral status is 'pending' or 'completed'
 */
export async function checkReferralEligibility(userId: string): Promise<{
  eligible: boolean
  referralId?: string
  discountPercent: number
}> {
  const supabase = getSupabaseAdminClient()

  // Check if user has a referral record and hasn't used the discount
  const { data: referral, error } = await supabase
    .from('referrals')
    .select('id, status')
    .eq('referred_id', userId)
    .in('status', ['pending', 'completed'])
    .single()

  if (error || !referral) {
    return {
      eligible: false,
      discountPercent: 0,
    }
  }

  // Check if user has already used referral discount
  const { data: promoUsage } = await supabase
    .from('promo_usage')
    .select('id')
    .eq('user_id', userId)
    .eq('promo_type', 'referral')
    .limit(1)
    .single()

  if (promoUsage) {
    // Already used
    return {
      eligible: false,
      discountPercent: 0,
    }
  }

  return {
    eligible: true,
    referralId: referral.id,
    discountPercent: 8, // 8% discount
  }
}

/**
 * Check if user is eligible for early bird discount (15% off, first 50 signups)
 */
export async function checkEarlyBirdEligibility(userId: string): Promise<{
  eligible: boolean
  discountPercent: number
}> {
  const supabase = getSupabaseAdminClient()

  // Check if user is marked as early bird eligible
  const { data: user } = await supabase
    .from('user_profiles')
    .select('early_bird_eligible')
    .eq('id', userId)
    .single()

  if (!user || !user.early_bird_eligible) {
    return {
      eligible: false,
      discountPercent: 0,
    }
  }

  // Check if user has already used early bird discount
  const { data: promoUsage } = await supabase
    .from('promo_usage')
    .select('id')
    .eq('user_id', userId)
    .eq('promo_type', 'early_bird')
    .limit(1)
    .single()

  if (promoUsage) {
    // Already used
    return {
      eligible: false,
      discountPercent: 0,
    }
  }

  return {
    eligible: true,
    discountPercent: 15, // 15% discount
  }
}

/**
 * Get all available promotions for a user
 */
export async function getPromoEligibility(userId: string): Promise<PromoEligibility> {
  const [referral, earlyBird] = await Promise.all([
    checkReferralEligibility(userId),
    checkEarlyBirdEligibility(userId),
  ])

  // User can only use one promo at a time - early bird takes priority (higher discount)
  const hasReferralDiscount = referral.eligible
  const hasEarlyBirdDiscount = earlyBird.eligible

  // If both are eligible, use the higher discount (early bird 15% > referral 8%)
  const maxDiscountPercent = hasEarlyBirdDiscount
    ? earlyBird.discountPercent
    : hasReferralDiscount
    ? referral.discountPercent
    : 0

  return {
    hasReferralDiscount,
    hasEarlyBirdDiscount,
    referralDiscountPercent: referral.discountPercent,
    earlyBirdDiscountPercent: earlyBird.discountPercent,
    totalDiscountPercent: maxDiscountPercent, // Only one can be used
    maxDiscountPercent,
  }
}

/**
 * Apply discount to package price
 * Returns the discounted amount and details
 */
export async function applyDiscount(
  userId: string,
  packagePriceCents: number,
  promoType: 'referral' | 'early_bird'
): Promise<AppliedDiscount> {
  const eligibility = await getPromoEligibility(userId)

  // Determine which discount to apply
  let discountPercent = 0
  let selectedPromoType: 'referral' | 'early_bird' | null = null

  if (promoType === 'early_bird' && eligibility.hasEarlyBirdDiscount) {
    discountPercent = eligibility.earlyBirdDiscountPercent
    selectedPromoType = 'early_bird'
  } else if (promoType === 'referral' && eligibility.hasReferralDiscount) {
    discountPercent = eligibility.referralDiscountPercent
    selectedPromoType = 'referral'
  } else {
    // Auto-select best available discount
    if (eligibility.hasEarlyBirdDiscount) {
      discountPercent = eligibility.earlyBirdDiscountPercent
      selectedPromoType = 'early_bird'
    } else if (eligibility.hasReferralDiscount) {
      discountPercent = eligibility.referralDiscountPercent
      selectedPromoType = 'referral'
    }
  }

  // Calculate discount
  const discountAmountCents = Math.round((packagePriceCents * discountPercent) / 100)
  const finalAmountCents = packagePriceCents - discountAmountCents

  return {
    discountPercent,
    discountAmountCents,
    originalAmountCents: packagePriceCents,
    finalAmountCents,
    promoType: selectedPromoType,
  }
}

/**
 * Record promo usage after successful payment
 */
export async function recordPromoUsage(params: {
  userId: string
  promoType: 'referral' | 'early_bird'
  discountPercent: number
  discountAmountCents: number
  packageId: string
  paymentId: string
}): Promise<string> {
  const supabase = getSupabaseAdminClient()

  const { data: promoUsage, error } = await supabase
    .from('promo_usage')
    .insert({
      user_id: params.userId,
      promo_type: params.promoType,
      discount_percent: params.discountPercent,
      discount_amount_cents: params.discountAmountCents,
      package_id: params.packageId,
      payment_id: params.paymentId,
    })
    .select('id')
    .single()

  if (error || !promoUsage) {
    throw new ApiError(
      'SERVER_ERROR',
      'Failed to record promo usage',
      500,
      error
    )
  }

  // If referral discount was used, update referral status
  if (params.promoType === 'referral') {
    const { data: referral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', params.userId)
      .in('status', ['pending', 'completed'])
      .single()

    if (referral) {
      await supabase
        .from('referrals')
        .update({
          status: 'used',
          discount_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', referral.id)
    }
  }

  return promoUsage.id
}

/**
 * Create referral relationship when user signs up with referral code
 */
export async function createReferral(params: {
  referrerId: string
  referredId: string
  referralCode: string
}): Promise<string> {
  const supabase = getSupabaseAdminClient()

  // Check if referral code is valid (belongs to referrer)
  const { data: existingReferral } = await supabase
    .from('referrals')
    .select('id')
    .eq('referral_code', params.referralCode)
    .eq('referrer_id', params.referrerId)
    .single()

  if (!existingReferral) {
    // Create new referral record
    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: params.referrerId,
        referred_id: params.referredId,
        referral_code: params.referralCode,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error || !referral) {
      throw new ApiError(
        'SERVER_ERROR',
        'Failed to create referral',
        500,
        error
      )
    }

    return referral.id
  }

  return existingReferral.id
}

/**
 * Get user's referral code (for sharing)
 */
export async function getUserReferralCode(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient()

  // Check if user already has a referral code
  const { data: existing } = await supabase
    .from('referrals')
    .select('referral_code')
    .eq('referrer_id', userId)
    .limit(1)
    .single()

  if (existing) {
    return existing.referral_code
  }

  // Generate new referral code
  const { data: codeData } = await supabase.rpc('generate_referral_code', {
    user_id_param: userId,
  })

  return codeData || null
}

