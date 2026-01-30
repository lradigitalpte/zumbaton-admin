-- Link payments to admin-issued referral vouchers so we can mark voucher as used on success
-- Runs after 20260131_create_referral_vouchers
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS referral_voucher_id UUID REFERENCES referral_vouchers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_referral_voucher ON payments(referral_voucher_id) WHERE referral_voucher_id IS NOT NULL;

COMMENT ON COLUMN payments.referral_voucher_id IS 'Admin-issued voucher used for this payment; marked used when payment succeeds.';
