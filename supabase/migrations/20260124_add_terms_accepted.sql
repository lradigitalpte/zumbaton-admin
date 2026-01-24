-- Add terms_accepted field to registration_forms
ALTER TABLE registration_forms 
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN registration_forms.terms_accepted IS 'User consent for Terms and Conditions';
