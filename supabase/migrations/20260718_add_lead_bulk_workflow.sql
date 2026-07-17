-- Bulk workflow additions: cold leads and reversible archiving.
ALTER TABLE marketing_leads DROP CONSTRAINT IF EXISTS marketing_leads_status_check;
ALTER TABLE marketing_leads ADD CONSTRAINT marketing_leads_status_check CHECK (status IN (
  'new', 'attempted_contact', 'contacted', 'follow_up', 'trial_scheduled',
  'trial_attended', 'converted', 'not_interested', 'unreachable', 'cold'
));

ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_leads_archived ON marketing_leads(archived_at) WHERE archived_at IS NOT NULL;
