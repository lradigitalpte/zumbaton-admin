-- =====================================================
-- MIGRATION: Support invoices for guest trial bookings
-- Allows invoices to be issued to guests (no auth.users row),
-- and guards against duplicate invoices per payment.
-- =====================================================

-- Guests have no account, so user_id can no longer be required.
ALTER TABLE invoices ALTER COLUMN user_id DROP NOT NULL;

-- Guest identity, captured directly on the invoice (guests have no
-- profile row to join against later).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- Line-item text, e.g. "Zumba Step — Trial Class" or "Starter Pack — 10 tokens".
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;

-- Every invoice must be attributable to a registered user or a guest.
ALTER TABLE invoices ADD CONSTRAINT invoices_user_or_guest_check
  CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL);

-- One invoice per payment — guards against the webhook and the
-- status-sync fallback both firing for the same successful payment.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_payment_id_unique
  ON invoices(payment_id) WHERE payment_id IS NOT NULL;
