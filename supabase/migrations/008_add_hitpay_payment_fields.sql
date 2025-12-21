-- =====================================================
-- MIGRATION: Add HitPay Payment Gateway Support
-- =====================================================
-- This migration adds fields to support HitPay payment gateway
-- while maintaining backward compatibility with existing Stripe fields.
--
-- HitPay is a Singapore-based payment gateway supporting:
-- - PayNow (QR code payments)
-- - Credit/Debit Cards (Visa, Mastercard, Amex)
-- - GrabPay
-- - Apple Pay / Google Pay
-- - AliPay / WeChat Pay
-- =====================================================

-- Add provider column to identify payment gateway
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'hitpay'
CHECK (provider IN ('hitpay', 'stripe', 'manual'));

-- Add HitPay-specific columns
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS hitpay_payment_request_id VARCHAR(255);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS hitpay_payment_id VARCHAR(255);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS hitpay_payment_url TEXT;

-- Update status check constraint to include 'expired' (HitPay specific)
-- First, drop the existing constraint
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_status_check;

-- Add updated constraint
ALTER TABLE payments
ADD CONSTRAINT payments_status_check
CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'expired'));

-- Create indexes for HitPay lookups
CREATE INDEX IF NOT EXISTS idx_payments_hitpay_request
ON payments(hitpay_payment_request_id)
WHERE hitpay_payment_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_hitpay_payment
ON payments(hitpay_payment_id)
WHERE hitpay_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_provider
ON payments(provider);

-- Update default currency to SGD for Singapore
ALTER TABLE payments
ALTER COLUMN currency SET DEFAULT 'SGD';

-- Also update packages default currency
ALTER TABLE packages
ALTER COLUMN currency SET DEFAULT 'SGD';

-- =====================================================
-- COMMENT: Migration Notes
-- =====================================================
-- After running this migration:
-- 1. Set environment variables in .env:
--    - HITPAY_API_KEY: Your HitPay API key
--    - HITPAY_SALT: Your HitPay salt for webhook verification
--    - HITPAY_ENV: 'sandbox' for testing, 'production' for live
--
-- 2. Configure webhook URL in HitPay dashboard:
--    - Sandbox: https://your-app.vercel.app/api/payments/hitpay-webhook
--    - Production: https://your-app.com/api/payments/hitpay-webhook
--
-- 3. Update existing packages to use SGD currency if needed
-- =====================================================
