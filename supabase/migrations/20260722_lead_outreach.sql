-- Lead marketing export and outbound follow-up queue.

CREATE TABLE IF NOT EXISTS lead_outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT '',
  channels TEXT[] NOT NULL DEFAULT '{}',
  email_subject TEXT,
  email_body TEXT,
  whatsapp_template TEXT,
  whatsapp_body TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  total_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS lead_outreach_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES lead_outreach_campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES marketing_leads(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  recipient TEXT NOT NULL DEFAULT '',
  lead_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'skipped')),
  provider_message_id TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lead_outreach_messages_pending
  ON lead_outreach_messages(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_lead_outreach_messages_campaign
  ON lead_outreach_messages(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_outreach_campaigns_created
  ON lead_outreach_campaigns(created_at DESC);

ALTER TABLE lead_outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_outreach_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lead_outreach_campaigns FROM anon, authenticated;
REVOKE ALL ON lead_outreach_messages FROM anon, authenticated;

-- Expand lead activity types for outreach and export logging.
ALTER TABLE lead_activities DROP CONSTRAINT IF EXISTS lead_activities_activity_type_check;
ALTER TABLE lead_activities ADD CONSTRAINT lead_activities_activity_type_check CHECK (activity_type IN (
  'created', 'imported', 'status_changed', 'note_added', 'assigned', 'follow_up_set',
  'contacted', 'converted', 'updated', 'reminder_sent', 'exported', 'outreach_sent'
));

COMMENT ON TABLE lead_outreach_campaigns IS 'Queued bulk follow-up sends to CRM leads.';
COMMENT ON TABLE lead_outreach_messages IS 'Per-recipient outbound message queue with delivery status.';
