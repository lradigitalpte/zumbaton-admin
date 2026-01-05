-- =====================================================
-- Add Discount Columns to Payments Table
-- Run this in Supabase SQL Editor if migration 010 hasn't been applied
-- =====================================================

-- First, ensure promo_usage table exists (needed for foreign key)
-- If it doesn't exist, create it first
CREATE TABLE IF NOT EXISTS promo_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  promo_type VARCHAR(50) NOT NULL CHECK (promo_type IN ('referral', 'early_bird')),
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  discount_amount_cents INTEGER NOT NULL,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add discount fields to payments table
-- Note: We add promo_usage_id column without the foreign key first if it might fail
DO $$
BEGIN
  -- Add columns one by one to avoid issues
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'discount_percent'
  ) THEN
    ALTER TABLE payments ADD COLUMN discount_percent INTEGER DEFAULT 0;
    ALTER TABLE payments ADD CONSTRAINT payments_discount_percent_check 
      CHECK (discount_percent >= 0 AND discount_percent <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'discount_amount_cents'
  ) THEN
    ALTER TABLE payments ADD COLUMN discount_amount_cents INTEGER DEFAULT 0;
    ALTER TABLE payments ADD CONSTRAINT payments_discount_amount_cents_check 
      CHECK (discount_amount_cents >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'original_amount_cents'
  ) THEN
    ALTER TABLE payments ADD COLUMN original_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'promo_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN promo_type VARCHAR(50);
    ALTER TABLE payments ADD CONSTRAINT payments_promo_type_check 
      CHECK (promo_type IN ('referral', 'early_bird', NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'promo_usage_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN promo_usage_id UUID;
    -- Add foreign key constraint
    ALTER TABLE payments ADD CONSTRAINT payments_promo_usage_id_fkey 
      FOREIGN KEY (promo_usage_id) REFERENCES promo_usage(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN payments.discount_percent IS 'Discount percentage applied (0-100)';
COMMENT ON COLUMN payments.discount_amount_cents IS 'Actual discount amount in cents';
COMMENT ON COLUMN payments.original_amount_cents IS 'Original package price before discount';
COMMENT ON COLUMN payments.promo_type IS 'Type of promotion used: referral (8%) or early_bird (15%)';
COMMENT ON COLUMN payments.promo_usage_id IS 'Reference to promo_usage record for this promotion';

-- Verify columns were added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('discount_percent', 'discount_amount_cents', 'original_amount_cents', 'promo_type', 'promo_usage_id')
ORDER BY ordinal_position;
