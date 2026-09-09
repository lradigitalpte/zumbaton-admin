-- =====================================================
-- Migration: Add 'admin-sale' transaction type
-- =====================================================
-- Admin-sold packages (the "Sell Package" panel) previously reused the
-- 'purchase' transaction_type, making them indistinguishable from real
-- HitPay/Stripe purchases in the Token Activity dashboard. This adds a
-- dedicated type so they render with their own badge.
-- =====================================================

ALTER TABLE token_transactions
DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE token_transactions
ADD CONSTRAINT token_transactions_transaction_type_check
CHECK (transaction_type IN (
  'purchase', 'booking-hold', 'booking-release', 'attendance-consume',
  'no-show-consume', 'late-cancel-consume', 'admin-adjust', 'admin-sale',
  'refund', 'expire', 'trial-booking-purchase'
));
