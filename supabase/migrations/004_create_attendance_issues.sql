-- =====================================================
-- MIGRATION: Create attendance_issues table
-- Run this in Supabase SQL Editor
-- Tracks resolution status for no-shows, late cancels, etc.
-- =====================================================

-- Create attendance_issues table
CREATE TABLE IF NOT EXISTS attendance_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  issue_type VARCHAR(30) NOT NULL CHECK (issue_type IN ('no-show', 'late-cancel', 'early-cancel', 'expired')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'excused', 'penalized', 'resolved')),
  token_refunded BOOLEAN DEFAULT FALSE,
  penalty_applied BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX idx_attendance_issues_user ON attendance_issues(user_id);
CREATE INDEX idx_attendance_issues_status ON attendance_issues(status);
CREATE INDEX idx_attendance_issues_type ON attendance_issues(issue_type);
CREATE INDEX idx_attendance_issues_created ON attendance_issues(created_at DESC);

-- Enable RLS
ALTER TABLE attendance_issues ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view all attendance issues" ON attendance_issues
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin', 'manager', 'instructor', 'receptionist')
    )
  );

CREATE POLICY "Staff can insert attendance issues" ON attendance_issues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin', 'manager', 'instructor', 'receptionist')
    )
  );

CREATE POLICY "Staff can update attendance issues" ON attendance_issues
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Function to automatically create issues from booking status changes
CREATE OR REPLACE FUNCTION create_attendance_issue()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create issue for certain status changes
  IF NEW.status IN ('no-show', 'cancelled-late') AND OLD.status != NEW.status THEN
    INSERT INTO attendance_issues (booking_id, user_id, class_id, issue_type, status)
    VALUES (
      NEW.id,
      NEW.user_id,
      NEW.class_id,
      CASE 
        WHEN NEW.status = 'no-show' THEN 'no-show'
        WHEN NEW.status = 'cancelled-late' THEN 'late-cancel'
        ELSE 'no-show'
      END,
      'pending'
    )
    ON CONFLICT (booking_id) DO NOTHING;
  END IF;
  
  -- Handle early cancellation
  IF NEW.status = 'cancelled' AND OLD.status = 'confirmed' THEN
    -- Check if this was an early cancellation (more than 4 hours before class)
    DECLARE
      class_time TIMESTAMPTZ;
      hours_before NUMERIC;
    BEGIN
      SELECT scheduled_at INTO class_time FROM classes WHERE id = NEW.class_id;
      hours_before := EXTRACT(EPOCH FROM (class_time - NOW())) / 3600;
      
      -- If less than 4 hours before but still cancelled (late), record as late cancel
      IF hours_before < 4 AND hours_before > 0 THEN
        INSERT INTO attendance_issues (booking_id, user_id, class_id, issue_type, status)
        VALUES (NEW.id, NEW.user_id, NEW.class_id, 'late-cancel', 'pending')
        ON CONFLICT (booking_id) DO NOTHING;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic issue creation
DROP TRIGGER IF EXISTS booking_status_change_trigger ON bookings;
CREATE TRIGGER booking_status_change_trigger
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION create_attendance_issue();

-- View to get user's no-show count
CREATE OR REPLACE VIEW user_no_show_counts AS
SELECT 
  user_id,
  COUNT(*) FILTER (WHERE issue_type = 'no-show') as no_show_count,
  COUNT(*) FILTER (WHERE issue_type = 'late-cancel') as late_cancel_count,
  COUNT(*) FILTER (WHERE status = 'penalized') as penalized_count
FROM attendance_issues
GROUP BY user_id;

-- Verify table created
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'attendance_issues'
ORDER BY ordinal_position;
