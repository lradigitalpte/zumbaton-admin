-- Per-email send log with open/click tracking (first used by the Friday week-streak reminder).
--
-- One row per email sent. The row id is the tracking token embedded in the email:
--   open pixel:  <web>/api/email/t/<id>/open
--   click link:  <web>/api/email/t/<id>/click?to=/book-classes
-- Written by the admin app (send) and the web app (open/click) using the service role.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,                       -- e.g. 'streak_reminder'
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  week_start DATE,                          -- Singapore week the email belongs to (streak reminders)
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,  -- e.g. { "streak_weeks": 4 }
  status TEXT NOT NULL DEFAULT 'sending',   -- sending | sent | failed
  error TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,                    -- first open
  open_count INTEGER NOT NULL DEFAULT 0,
  clicked_at TIMESTAMPTZ,                   -- first click
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_sends_kind_week_idx ON email_sends (kind, week_start);
CREATE INDEX IF NOT EXISTS email_sends_user_idx ON email_sends (user_id);

ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (API routes / cron) can read or write.

-- Atomic open/click counter (no read-modify-write races when a mail client
-- loads the pixel several times at once).
CREATE OR REPLACE FUNCTION track_email_event(p_id UUID, p_event TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_event = 'open' THEN
    UPDATE email_sends
      SET open_count = open_count + 1,
          opened_at = COALESCE(opened_at, NOW())
      WHERE id = p_id;
  ELSIF p_event = 'click' THEN
    -- A click implies the email was opened, even if images were blocked.
    UPDATE email_sends
      SET click_count = click_count + 1,
          clicked_at = COALESCE(clicked_at, NOW()),
          opened_at = COALESCE(opened_at, NOW())
      WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION track_email_event(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION track_email_event(UUID, TEXT) TO service_role;
