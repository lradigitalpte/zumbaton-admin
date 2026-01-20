#!/usr/bin/env node

/**
 * Generate Cron Jobs SQL with your configuration
 * 
 * Usage:
 *   node scripts/generate-cron-sql.js
 * 
 * This will prompt you for:
 *   - Admin App URL
 *   - CRON_SECRET
 * 
 * Then it will generate the SQL file ready to run in Supabase
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🚀 Cron Jobs SQL Generator\n');
  console.log('This script will generate SQL to set up cron jobs in Supabase.\n');

  const adminUrl = await question('Enter your Admin App URL (e.g., https://admin.zumbaton.sg): ');
  const cronSecret = await question('Enter your CRON_SECRET: ');

  if (!adminUrl || !cronSecret) {
    console.error('\n❌ Error: Both Admin App URL and CRON_SECRET are required!');
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(adminUrl);
  } catch (e) {
    console.error('\n❌ Error: Invalid URL format. Please use https://...');
    process.exit(1);
  }

  const sql = `-- ============================================
-- Setup Cron Jobs for Scheduled Tasks
-- Generated: ${new Date().toISOString()}
-- ============================================
-- Admin App URL: ${adminUrl}
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================
-- JOB 1: Class Reminders (every 15 minutes)
-- ============================================
SELECT cron.schedule(
  'send-class-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := '${adminUrl}/api/cron?job=class-reminders',
    headers := '{"Authorization": "Bearer ${cronSecret}", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- JOB 2: Waitlist Expiry (every 15 minutes)
-- ============================================
SELECT cron.schedule(
  'process-waitlist-expiry',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := '${adminUrl}/api/cron?job=waitlist-expiry',
    headers := '{"Authorization": "Bearer ${cronSecret}", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- JOB 3: No-Shows (every hour)
-- ============================================
SELECT cron.schedule(
  'process-no-shows',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := '${adminUrl}/api/cron?job=no-shows',
    headers := '{"Authorization": "Bearer ${cronSecret}", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- JOB 4: Token Expiry Warnings (daily at 9am UTC)
-- ============================================
SELECT cron.schedule(
  'send-token-expiry-warnings',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := '${adminUrl}/api/cron?job=token-warnings',
    headers := '{"Authorization": "Bearer ${cronSecret}", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- JOB 5: Token Balance Low (daily at 10am UTC)
-- ============================================
SELECT cron.schedule(
  'send-token-balance-low',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := '${adminUrl}/api/cron?job=all',
    headers := '{"Authorization": "Bearer ${cronSecret}", "Content-Type": "application/json"}'::jsonb,
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
    url := '${adminUrl}/api/cron?job=all',
    headers := '{"Authorization": "Bearer ${cronSecret}", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- View all scheduled jobs:
-- SELECT * FROM cron.job;

-- View job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Unschedule a specific job (if needed):
-- SELECT cron.unschedule('job-name-here');
`;

  const outputPath = path.join(__dirname, '..', 'supabase', 'migrations', '014_setup_cron_jobs_ready.sql');
  fs.writeFileSync(outputPath, sql);

  console.log('\n✅ SQL file generated successfully!');
  console.log(`📁 Location: ${outputPath}\n`);
  console.log('📋 Next steps:');
  console.log('   1. Go to Supabase Dashboard → SQL Editor');
  console.log('   2. Copy and paste the contents of the generated file');
  console.log('   3. Click "Run" to execute\n');
  console.log('⚠️  Important: Make sure you have:');
  console.log('   - Enabled pg_cron extension');
  console.log('   - Enabled pg_net extension');
  console.log('   - Set CRON_SECRET in your admin app environment variables\n');

  rl.close();
}

main().catch(console.error);
