-- =====================================================
-- TOKEN_ADJUSTMENTS TABLE
-- Tracks manual token adjustments with workflow
-- =====================================================

CREATE TABLE IF NOT EXISTS token_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Adjustment details
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('credit', 'debit', 'correction', 'promo', 'refund')),
  amount INTEGER NOT NULL, -- positive for credit, negative for debit
  reason TEXT NOT NULL,
  notes TEXT,
  
  -- Workflow status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  
  -- Audit trail
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Balance tracking (filled when completed)
  balance_before INTEGER,
  balance_after INTEGER,
  
  -- Link to token transaction (created when completed)
  transaction_id UUID REFERENCES token_transactions(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_token_adjustments_user ON token_adjustments(user_id);
CREATE INDEX idx_token_adjustments_status ON token_adjustments(status);
CREATE INDEX idx_token_adjustments_type ON token_adjustments(adjustment_type);
CREATE INDEX idx_token_adjustments_created ON token_adjustments(created_at DESC);

-- Enable RLS
ALTER TABLE token_adjustments ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admins can view all adjustments
CREATE POLICY "Admins can view all adjustments"
  ON token_adjustments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Admins can create adjustments
CREATE POLICY "Admins can create adjustments"
  ON token_adjustments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Admins can update adjustments
CREATE POLICY "Admins can update adjustments"
  ON token_adjustments FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Users can view their own adjustments
CREATE POLICY "Users can view own adjustments"
  ON token_adjustments FOR SELECT
  USING (auth.uid() = user_id);
