-- Email open/click tracking for lead outreach messages (Resend webhooks).

ALTER TABLE lead_outreach_messages
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

ALTER TABLE lead_outreach_messages DROP CONSTRAINT IF EXISTS lead_outreach_messages_status_check;
ALTER TABLE lead_outreach_messages ADD CONSTRAINT lead_outreach_messages_status_check
  CHECK (status IN (
    'pending', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'skipped'
  ));

CREATE INDEX IF NOT EXISTS idx_lead_outreach_messages_provider_id
  ON lead_outreach_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

COMMENT ON COLUMN lead_outreach_messages.opened_at IS 'First open timestamp from Resend email.opened webhook.';
COMMENT ON COLUMN lead_outreach_messages.clicked_at IS 'First click timestamp from Resend email.clicked webhook.';
