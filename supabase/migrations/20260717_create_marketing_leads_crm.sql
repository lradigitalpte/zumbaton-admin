-- Unified marketing leads CRM for Meta, TikTok, Google Sheets and manual leads.
CREATE TABLE IF NOT EXISTS marketing_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('meta', 'facebook', 'instagram', 'tiktok', 'website', 'google_sheets', 'manual', 'other')),
  platform TEXT,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  normalized_phone TEXT,
  email TEXT,
  normalized_email TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'attempted_contact', 'contacted', 'follow_up', 'trial_scheduled',
    'trial_attended', 'converted', 'not_interested', 'unreachable'
  )),
  assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  next_follow_up_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  lost_reason TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  form_id TEXT,
  form_name TEXT,
  click_id TEXT,
  submitted_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  raw_form_data JSONB NOT NULL DEFAULT '{}',
  imported_from TEXT,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_source_external
  ON marketing_leads(source, external_id);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_status ON marketing_leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_source ON marketing_leads(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_phone ON marketing_leads(normalized_phone) WHERE normalized_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_leads_email ON marketing_leads(normalized_email) WHERE normalized_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_leads_follow_up ON marketing_leads(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('created', 'imported', 'status_changed', 'note_added', 'assigned', 'follow_up_set', 'contacted', 'converted', 'updated')),
  note TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS marketing_lead_id UUID REFERENCES marketing_leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_marketing_lead ON bookings(marketing_lead_id) WHERE marketing_lead_id IS NOT NULL;

ALTER TABLE marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

-- Admin routes use the service-role client. Explicitly deny direct anon/authenticated table access.
REVOKE ALL ON marketing_leads FROM anon, authenticated;
REVOKE ALL ON lead_activities FROM anon, authenticated;

COMMENT ON TABLE marketing_leads IS 'Canonical CRM records imported from ad platforms, forms and sheets.';
COMMENT ON COLUMN marketing_leads.raw_form_data IS 'Unmodified source payload so new form questions are never lost.';
