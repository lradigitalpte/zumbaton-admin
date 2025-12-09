-- =====================================================
-- INSTRUCTOR AVAILABILITY TABLE
-- Stores weekly availability slots for instructors
-- =====================================================

CREATE TABLE IF NOT EXISTS instructor_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  UNIQUE(instructor_id, day_of_week, start_time, end_time)
);

CREATE INDEX idx_instructor_availability_instructor ON instructor_availability(instructor_id);
CREATE INDEX idx_instructor_availability_day ON instructor_availability(day_of_week);
CREATE INDEX idx_instructor_availability_active ON instructor_availability(is_active) WHERE is_active = true;

-- =====================================================
-- TIME OFF REQUESTS TABLE
-- Stores instructor time off requests
-- =====================================================

CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_time_off_requests_instructor ON time_off_requests(instructor_id);
CREATE INDEX idx_time_off_requests_dates ON time_off_requests(start_date, end_date);
CREATE INDEX idx_time_off_requests_status ON time_off_requests(status);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE instructor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;

-- Instructor Availability Policies
CREATE POLICY "Instructors can view own availability"
  ON instructor_availability FOR SELECT
  USING (instructor_id = auth.uid() OR is_admin_or_above(auth.uid()));

CREATE POLICY "Instructors can manage own availability"
  ON instructor_availability FOR ALL
  USING (instructor_id = auth.uid() OR is_admin_or_above(auth.uid()));

-- Time Off Requests Policies
CREATE POLICY "Instructors can view own time off requests"
  ON time_off_requests FOR SELECT
  USING (instructor_id = auth.uid() OR is_admin_or_above(auth.uid()));

CREATE POLICY "Instructors can create time off requests"
  ON time_off_requests FOR INSERT
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Instructors can update own pending requests"
  ON time_off_requests FOR UPDATE
  USING (
    (instructor_id = auth.uid() AND status = 'pending') OR 
    is_admin_or_above(auth.uid())
  );

CREATE POLICY "Admins can delete time off requests"
  ON time_off_requests FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================

CREATE TRIGGER update_instructor_availability_updated_at
  BEFORE UPDATE ON instructor_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_off_requests_updated_at
  BEFORE UPDATE ON time_off_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
