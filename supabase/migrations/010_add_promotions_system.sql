-- =====================================================
-- Migration: Add Promotions System (Referrals & Early Bird)
-- Date: 2025-01-08
-- Description: Adds referral tracking and early bird promo support
-- =====================================================

-- =====================================================
-- REFERRALS TABLE
-- Tracks referral relationships between users
-- =====================================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'used')),
  -- 'pending': Referred user signed up but hasn't purchased yet
  -- 'completed': Referred user made their first purchase (referrer gets credit)
  -- 'used': Referred user used their 8% discount
  discount_used_at TIMESTAMPTZ,
  referrer_credit_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id) -- Each user can only be referred once
);

-- Indexes for referrals
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);

-- =====================================================
-- PROMO_USAGE TABLE
-- Tracks which users have used which promotions
-- =====================================================
CREATE TABLE IF NOT EXISTS promo_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  promo_type VARCHAR(50) NOT NULL CHECK (promo_type IN ('referral', 'early_bird')),
  -- 'referral': 8% discount on next package purchase
  -- 'early_bird': 15% discount (first 50 signups)
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  discount_amount_cents INTEGER NOT NULL, -- Actual discount applied in cents
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for promo usage
CREATE INDEX idx_promo_usage_user ON promo_usage(user_id);
CREATE INDEX idx_promo_usage_type ON promo_usage(promo_type);
CREATE INDEX idx_promo_usage_payment ON promo_usage(payment_id);

-- =====================================================
-- Add early_bird_eligible flag to user_profiles
-- =====================================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS early_bird_eligible BOOLEAN DEFAULT false;

CREATE INDEX idx_user_profiles_early_bird ON user_profiles(early_bird_eligible) WHERE early_bird_eligible = true;

-- =====================================================
-- Add referral_code to user_profiles (code they used when signing up)
-- =====================================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS referral_code_used VARCHAR(50);

CREATE INDEX idx_user_profiles_referral_code ON user_profiles(referral_code_used);

-- =====================================================
-- Add discount fields to payments table
-- =====================================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
ADD COLUMN IF NOT EXISTS discount_amount_cents INTEGER DEFAULT 0 CHECK (discount_amount_cents >= 0),
ADD COLUMN IF NOT EXISTS original_amount_cents INTEGER, -- Original price before discount
ADD COLUMN IF NOT EXISTS promo_type VARCHAR(50) CHECK (promo_type IN ('referral', 'early_bird', NULL)),
ADD COLUMN IF NOT EXISTS promo_usage_id UUID REFERENCES promo_usage(id) ON DELETE SET NULL;

-- =====================================================
-- Function: Check if user is in first 50 signups (early bird eligible)
-- =====================================================
CREATE OR REPLACE FUNCTION check_early_bird_eligibility(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  signup_rank INTEGER;
BEGIN
  -- Get the user's signup rank (1 = first user, 2 = second, etc.)
  SELECT COUNT(*) + 1 INTO signup_rank
  FROM user_profiles
  WHERE created_at < (
    SELECT created_at FROM user_profiles WHERE id = user_id_param
  );
  
  -- User is eligible if they're in the first 50
  RETURN signup_rank <= 50;
END;
$$;

-- =====================================================
-- Function: Mark user as early bird eligible (called on signup)
-- =====================================================
CREATE OR REPLACE FUNCTION mark_early_bird_if_eligible()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_users INTEGER;
  early_bird_enabled BOOLEAN := true;
  early_bird_limit INTEGER := 50;
  promo_settings JSONB;
BEGIN
  -- Check if early bird is enabled in system_settings
  BEGIN
    SELECT value INTO promo_settings
    FROM system_settings
    WHERE key = 'promotions'
    LIMIT 1;
    
    IF promo_settings IS NOT NULL THEN
      early_bird_enabled := COALESCE((promo_settings ->> 'early_bird_enabled')::boolean, true);
      early_bird_limit := COALESCE((promo_settings ->> 'early_bird_limit')::integer, 50);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If system_settings table doesn't exist or query fails, use defaults
    early_bird_enabled := true;
    early_bird_limit := 50;
  END;
  
  -- Only mark as early bird eligible if the feature is enabled
  IF early_bird_enabled THEN
    -- Count total users (including the one just created)
    SELECT COUNT(*) INTO total_users FROM user_profiles;
    
    -- If this is one of the first N users (where N is early_bird_limit), mark as eligible
    IF total_users <= early_bird_limit THEN
      UPDATE user_profiles
      SET early_bird_eligible = true
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-mark early bird users
DROP TRIGGER IF EXISTS trigger_mark_early_bird ON user_profiles;
CREATE TRIGGER trigger_mark_early_bird
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION mark_early_bird_if_eligible();

-- =====================================================
-- Function: Generate unique referral code for user
-- =====================================================
CREATE OR REPLACE FUNCTION generate_referral_code(user_id_param UUID)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code VARCHAR(50);
  exists_check BOOLEAN;
BEGIN
  -- Generate code: ZUMB-{first 8 chars of user_id}
  code := 'ZUMB-' || UPPER(SUBSTRING(user_id_param::text, 1, 8));
  
  -- Check if code already exists (unlikely but possible)
  SELECT EXISTS(SELECT 1 FROM referrals WHERE referral_code = code) INTO exists_check;
  
  -- If exists, append random chars
  IF exists_check THEN
    code := code || '-' || UPPER(SUBSTRING(MD5(RANDOM()::text), 1, 4));
  END IF;
  
  RETURN code;
END;
$$;

-- =====================================================
-- RLS Policies for referrals
-- =====================================================
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referrals (as referrer or referred)
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT
  USING (
    auth.uid() = referrer_id OR 
    auth.uid() = referred_id
  );

-- System can create referrals (via service role)
-- Admins can view all referrals
CREATE POLICY "Admins can view all referrals"
  ON referrals FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND 
    is_admin_or_above(auth.uid()) = true
  );

-- =====================================================
-- RLS Policies for promo_usage
-- =====================================================
ALTER TABLE promo_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own promo usage
CREATE POLICY "Users can view own promo usage"
  ON promo_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all promo usage
CREATE POLICY "Admins can view all promo usage"
  ON promo_usage FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND 
    is_admin_or_above(auth.uid()) = true
  );

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE referrals IS 'Tracks referral relationships: referrer gets credit when referred user purchases, referred user gets 8% discount on next purchase';
COMMENT ON TABLE promo_usage IS 'Tracks which users have used which promotions (referral 8%, early bird 15%)';
COMMENT ON COLUMN user_profiles.early_bird_eligible IS 'True if user is one of the first 50 signups (eligible for 15% discount)';
COMMENT ON COLUMN user_profiles.referral_code_used IS 'Referral code the user entered when signing up';
COMMENT ON COLUMN payments.discount_percent IS 'Discount percentage applied (0-100)';
COMMENT ON COLUMN payments.discount_amount_cents IS 'Actual discount amount in cents';
COMMENT ON COLUMN payments.original_amount_cents IS 'Original package price before discount';
COMMENT ON COLUMN payments.promo_type IS 'Type of promotion used: referral (8%) or early_bird (15%)';

