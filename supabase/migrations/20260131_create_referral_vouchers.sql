-- Migration: Admin-issued referral vouchers
-- Admin generates a voucher (discount %) for a user, then sends email with the code.
-- User uses the code on their next token package purchase (user-side flow TBD).

CREATE TABLE IF NOT EXISTS referral_vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  voucher_code VARCHAR(50) NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_vouchers_user ON referral_vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_vouchers_code ON referral_vouchers(voucher_code);
CREATE INDEX IF NOT EXISTS idx_referral_vouchers_used ON referral_vouchers(used_at) WHERE used_at IS NULL;

COMMENT ON TABLE referral_vouchers IS 'Admin-issued discount vouchers; user receives email and uses code at next package purchase.';
