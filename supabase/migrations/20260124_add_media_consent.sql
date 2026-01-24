-- Add media consent field to registration forms
ALTER TABLE registration_forms 
ADD COLUMN IF NOT EXISTS media_consent BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN registration_forms.media_consent IS 'User consent for media usage (photos, videos on social media)';
