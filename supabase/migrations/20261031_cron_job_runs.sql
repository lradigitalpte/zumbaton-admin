-- Short notes from each scheduled job, so Settings → Health can show
-- the last run after the browser is closed.

CREATE TABLE IF NOT EXISTS public.cron_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  needs_attention BOOLEAN NOT NULL DEFAULT FALSE,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'desk',
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cron_job_runs_job_ran_at
  ON public.cron_job_runs (job_name, ran_at DESC);

ALTER TABLE public.cron_job_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.cron_job_runs IS
  'Latest outcomes of studio jobs. Read through the admin Health page.';
