-- ============================================
-- Setup Cron Jobs for Scheduled Tasks
-- ============================================
-- This migration sets up pg_cron jobs to automatically run scheduled tasks
-- like marking classes as completed, processing no-shows, sending reminders, etc.
--
-- ✅ READY TO RUN - All values have been configured:
--   - Admin App URL: https://admin.zumbaton.sg
--   - CRON_SECRET: Configured in environment variables
--
-- IMPORTANT: Before running this migration:
-- 1. ✅ Enable pg_cron extension in Supabase Dashboard → Database → Extensions
-- 2. ✅ Enable pg_net extension (required for HTTP calls)
-- 3. ✅ Set CRON_SECRET in your admin app environment variables (Vercel)
--
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================
-- CONFIGURATION
-- ============================================
-- Admin App URL: https://admin.zumbaton.sg
-- CRON_SECRET: Configured in environment variables
-- ============================================

-- ============================================
-- JOB 1: Class Reminders (every 15 minutes)
-- Sends reminder notifications 2 hours before class starts
-- ============================================
SELECT cron.schedule(
  'send-class-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://admin.zumbaton.sg/api/cron?job=class-reminders',
    headers := '{"Authorization": "Bearer 8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- JOB 2: Waitlist Expiry (every 15 minutes)
-- Expires waitlist offers not confirmed within 24 hours
-- ============================================
SELECT cron.schedule(
  'process-waitlist-expiry',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://admin.zumbaton.sg/api/cron?job=waitlist-expiry',
    headers := '{"Authorization": "Bearer 8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- JOB 3: No-Shows (every hour)
-- Marks bookings as no-show 30 minutes after class ends
-- ============================================
SELECT cron.schedule(
  'process-no-shows',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://admin.zumbaton.sg/api/cron?job=no-shows',
    headers := '{"Authorization": "Bearer 8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- JOB 4: Token Expiry Warnings (daily at 9am UTC)
-- Warns users whose token packages expire in 3 days
-- ============================================
SELECT cron.schedule(
  'send-token-expiry-warnings',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://admin.zumbaton.sg/api/cron?job=token-warnings',
    headers := '{"Authorization": "Bearer 8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- JOB 5: Token Balance Low (daily at 10am UTC)
-- Warns users when total token balance drops below 3
-- ============================================
SELECT cron.schedule(
  'send-token-balance-low',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://admin.zumbaton.sg/api/cron?job=all',
    headers := '{"Authorization": "Bearer 8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- JOB 6: Midnight Jobs (daily at midnight UTC)
-- Runs: expired packages, frozen packages, mark completed classes
-- ============================================
SELECT cron.schedule(
  'midnight-jobs',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://admin.zumbaton.sg/api/cron?job=all',
    headers := '{"Authorization": "Bearer 8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- HELPER QUERIES
-- ============================================

-- View all scheduled jobs:
-- SELECT * FROM cron.job;

-- View job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Unschedule a specific job:
-- SELECT cron.unschedule('job-name-here');

-- Unschedule all jobs (if needed):
-- SELECT cron.unschedule(jobid) FROM cron.job;
