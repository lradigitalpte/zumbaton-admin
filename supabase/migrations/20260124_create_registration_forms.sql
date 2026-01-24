-- Create table for registration form submissions
CREATE TABLE IF NOT EXISTS registration_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Form token for public access
  form_token TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Personal Information
  full_name_nric TEXT,
  residential_address TEXT,
  postal_code TEXT,
  date_of_birth DATE,
  email TEXT,
  phone TEXT,
  blood_group TEXT,
  emergency_contact TEXT,
  emergency_contact_phone TEXT,
  
  -- Parent/Guardian info (for members aged 5-15)
  parent_guardian_name TEXT,
  parent_guardian_signature TEXT,
  parent_guardian_date TIMESTAMPTZ,
  
  -- Member signature
  member_signature TEXT,
  member_signature_date TIMESTAMPTZ,
  
  -- Staff signature
  staff_name TEXT,
  staff_signature TEXT,
  staff_signature_date TIMESTAMPTZ,
  
  -- Tracking
  form_sent_at TIMESTAMPTZ,
  form_sent_by UUID REFERENCES user_profiles(id),
  form_completed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_registration_forms_user_id ON registration_forms(user_id);
CREATE INDEX idx_registration_forms_form_token ON registration_forms(form_token);
CREATE INDEX idx_registration_forms_status ON registration_forms(status);

-- Enable RLS
ALTER TABLE registration_forms ENABLE ROW LEVEL SECURITY;

-- Policies
-- Allow service role to do everything
CREATE POLICY "Service role can manage registration forms"
  ON registration_forms
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read their own forms
CREATE POLICY "Users can read their own registration forms"
  ON registration_forms
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow admin/super_admin to read all forms
CREATE POLICY "Admins can read all registration forms"
  ON registration_forms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_registration_forms_updated_at
  BEFORE UPDATE ON registration_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add registration_form_id column to user_profiles to track latest form
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS registration_form_id UUID REFERENCES registration_forms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_registration_form_id ON user_profiles(registration_form_id);

COMMENT ON TABLE registration_forms IS 'Stores registration form submissions with T&C acceptance';
COMMENT ON COLUMN registration_forms.form_token IS 'Unique token for accessing the form via public URL';
COMMENT ON COLUMN registration_forms.status IS 'Form status: pending, completed, expired';
