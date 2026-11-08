-- Funnel tracking for time-limited promos (first used by the 11:11 Sale).
-- Written only by the web app's service role (POST /api/promos/sale-1111/event);
-- read only by the admin app's service role. No public access.
-- Safe to re-run (all statements are IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS promo_events (
  id BIGSERIAL PRIMARY KEY,
  promo TEXT NOT NULL,
  event TEXT NOT NULL,
  path TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Who did it: set when the visitor is signed in, and back-filled onto their earlier
-- anonymous events (same browser visitor id) once they sign in / sign up.
ALTER TABLE promo_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS promo_events_promo_event_idx ON promo_events (promo, event);
CREATE INDEX IF NOT EXISTS promo_events_session_idx ON promo_events (promo, session_id);
CREATE INDEX IF NOT EXISTS promo_events_user_idx ON promo_events (promo, user_id);

ALTER TABLE promo_events ENABLE ROW LEVEL SECURITY;
-- No policies: anon / authenticated roles cannot read or write; the service role bypasses RLS.
