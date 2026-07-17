ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ;
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS starred_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_leads_starred ON marketing_leads(is_starred, starred_at DESC) WHERE is_starred = true;
