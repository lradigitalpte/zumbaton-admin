-- =====================================================
-- Migration: Create manual class enrollments tracking
-- Date: 2026-04-13
-- Description: Stores manually tracked enrollments for ZT Fiesta and individual lessons
-- =====================================================

CREATE TABLE IF NOT EXISTS manual_class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_type VARCHAR(50) NOT NULL CHECK (program_type IN ('zt_fiesta', 'individual_lesson')),
  source VARCHAR(30) NOT NULL DEFAULT 'public_form' CHECK (source IN ('public_form', 'admin_manual')),
  customer_name VARCHAR(200) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  participant_name VARCHAR(200),
  participant_date_of_birth DATE,
  package_code VARCHAR(50),
  package_label VARCHAR(100),
  sessions_purchased INTEGER NOT NULL CHECK (sessions_purchased > 0),
  sessions_used INTEGER NOT NULL DEFAULT 0 CHECK (sessions_used >= 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
  payment_status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'waived', 'cancelled')),
  payment_method VARCHAR(50),
  paid_at TIMESTAMPTZ,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  attendance_status VARCHAR(30) NOT NULL DEFAULT 'not_started'
    CHECK (attendance_status IN ('not_started', 'in_progress', 'completed', 'expired')),
  attendance_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE manual_class_enrollments
  ADD CONSTRAINT manual_class_enrollments_sessions_used_within_purchase
  CHECK (sessions_used <= sessions_purchased);

CREATE INDEX IF NOT EXISTS idx_manual_enrollments_program_type
  ON manual_class_enrollments(program_type);

CREATE INDEX IF NOT EXISTS idx_manual_enrollments_payment_status
  ON manual_class_enrollments(payment_status);

CREATE INDEX IF NOT EXISTS idx_manual_enrollments_customer_email
  ON manual_class_enrollments(customer_email);

CREATE INDEX IF NOT EXISTS idx_manual_enrollments_valid_until
  ON manual_class_enrollments(valid_until);

CREATE INDEX IF NOT EXISTS idx_manual_enrollments_created_at
  ON manual_class_enrollments(created_at DESC);

DROP TRIGGER IF EXISTS update_manual_class_enrollments_updated_at ON manual_class_enrollments;
CREATE TRIGGER update_manual_class_enrollments_updated_at
  BEFORE UPDATE ON manual_class_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE manual_class_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users read manual enrollments" ON manual_class_enrollments;
CREATE POLICY "Allow authenticated users read manual enrollments"
  ON manual_class_enrollments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users insert manual enrollments" ON manual_class_enrollments;
CREATE POLICY "Allow authenticated users insert manual enrollments"
  ON manual_class_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users update manual enrollments" ON manual_class_enrollments;
CREATE POLICY "Allow authenticated users update manual enrollments"
  ON manual_class_enrollments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE manual_class_enrollments IS 'Manual tracking records for programs that do not require direct booking-platform payment integration.';
