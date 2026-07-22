-- Saved outreach templates for lead marketing send engine.

CREATE TABLE IF NOT EXISTS lead_outreach_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp', 'both')),
  email_subject TEXT,
  email_body TEXT,
  whatsapp_body TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_outreach_templates_default ON lead_outreach_templates(is_default) WHERE is_default = true;

ALTER TABLE lead_outreach_campaigns ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES lead_outreach_templates(id) ON DELETE SET NULL;

ALTER TABLE lead_outreach_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lead_outreach_templates FROM anon, authenticated;

INSERT INTO lead_outreach_templates (name, channel, email_subject, email_body, whatsapp_body, is_default)
SELECT 'New lead follow-up', 'both',
  'Thanks for your interest in One Step Fitness!',
  E'Hi {{name}},\n\nThank you for reaching out to One Step Fitness! We''d love to help you get started with Zumba and fitness classes.\n\nReply to this email or WhatsApp us to book your trial class.\n\nSee you on the dance floor!\nOne Step Fitness Team',
  'Hi {{name}}, thanks for your interest in One Step Fitness! We''d love to help you book a trial class. Reply here anytime.',
  true
WHERE NOT EXISTS (SELECT 1 FROM lead_outreach_templates WHERE name = 'New lead follow-up');

INSERT INTO lead_outreach_templates (name, channel, email_subject, email_body, whatsapp_body, is_default)
SELECT 'Trial class invite', 'email',
  'Book your trial class at One Step Fitness',
  E'Hi {{first_name}},\n\nWe''d love to welcome you for a trial Zumba class at One Step Fitness!\n\nReply to this email with your preferred day and we''ll get you booked.\n\nOne Step Fitness Team',
  NULL,
  false
WHERE NOT EXISTS (SELECT 1 FROM lead_outreach_templates WHERE name = 'Trial class invite');

INSERT INTO lead_outreach_templates (name, channel, email_subject, email_body, whatsapp_body, is_default)
SELECT 'Re-engagement', 'email',
  'Still interested in joining One Step Fitness?',
  E'Hi {{first_name}},\n\nWe noticed you reached out to One Step Fitness recently. We still have spots in our classes and would love to see you!\n\nReply anytime to book a trial.\n\nOne Step Fitness Team',
  NULL,
  false
WHERE NOT EXISTS (SELECT 1 FROM lead_outreach_templates WHERE name = 'Re-engagement');

COMMENT ON TABLE lead_outreach_templates IS 'Reusable email/WhatsApp templates for lead outreach campaigns.';
