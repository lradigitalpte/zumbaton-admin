# 🚀 Cron Jobs Setup Guide for Supabase

This guide will help you set up automated cron jobs in Supabase to run scheduled tasks like marking classes as completed, processing no-shows, sending reminders, etc.

## 📋 Prerequisites

1. **Supabase Project** - Your admin app must be connected to Supabase
2. **Production Admin App URL** - Your deployed admin app URL (e.g., `https://admin.zumbaton.sg`)
3. **CRON_SECRET** - A secure random string for authentication

---

## 🔧 Step-by-Step Setup

### Step 1: Enable Extensions in Supabase

1. Go to your **Supabase Dashboard**
2. Navigate to **Database** → **Extensions**
3. Search for and enable these extensions:
   - ✅ **pg_cron** - For scheduling jobs
   - ✅ **pg_net** - For making HTTP requests

**How to enable:**
- Click on the extension name
- Click the toggle to enable it
- Wait for it to activate (usually instant)

---

### Step 2: Set CRON_SECRET Environment Variable

1. **Generate a secure random string:**
   ```bash
   # Option 1: Using openssl
   openssl rand -hex 32
   
   # Option 2: Using Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Option 3: Online generator
   # Visit: https://www.random.org/strings/
   ```

2. **Add to your admin app's environment variables:**
   - **Vercel**: Go to Project Settings → Environment Variables
   - **Local**: Add to `.env.local`:
     ```env
     CRON_SECRET=your-generated-secret-here
     ```

3. **Important**: Save this secret - you'll need it in Step 3!

---

### Step 3: Get Your Production Admin App URL

- If deployed on Vercel: `https://your-project.vercel.app`
- If custom domain: `https://admin.zumbaton.sg`
- **Note**: Use HTTPS, not HTTP

---

### Step 4: Run the Migration SQL

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open the migration file: `supabase/migrations/014_setup_cron_jobs.sql`
3. **Replace the placeholders** in the SQL:
   - Replace `YOUR_ADMIN_APP_URL` with your actual admin app URL
   - Replace `YOUR_CRON_SECRET` with your CRON_SECRET from Step 2

   **Example:**
   ```sql
   -- Before:
   url := 'YOUR_ADMIN_APP_URL/api/cron?job=class-reminders',
   
   -- After:
   url := 'https://admin.zumbaton.sg/api/cron?job=class-reminders',
   ```

4. **Run the SQL** by clicking "Run" or pressing `Ctrl+Enter`

---

### Step 5: Verify Jobs Are Created

Run this query in Supabase SQL Editor:

```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
ORDER BY jobname;
```

You should see 6 jobs:
- `send-class-reminders`
- `process-waitlist-expiry`
- `process-no-shows`
- `send-token-expiry-warnings`
- `send-token-balance-low`
- `midnight-jobs`

---

### Step 6: Test the Setup

#### Option A: Test via Admin UI
1. Go to your admin app: **Settings → Cron Jobs**
2. Click "Run All Jobs" or run individual jobs
3. Check if they execute successfully

#### Option B: Test via API
```bash
# Test all jobs
curl -X POST "https://your-admin-app.vercel.app/api/cron?job=all" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test specific job
curl -X POST "https://your-admin-app.vercel.app/api/cron?job=no-shows" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### Option C: Check Job History
Run this query in Supabase SQL Editor:

```sql
SELECT 
  jobid,
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

---

## 📊 Cron Job Schedule Summary

| Job Name | Frequency | What It Does |
|----------|-----------|--------------|
| `send-class-reminders` | Every 15 minutes | Sends reminders 2 hours before class |
| `process-waitlist-expiry` | Every 15 minutes | Expires waitlist offers after 24h |
| `process-no-shows` | Every hour | Marks no-shows 30min after class ends |
| `send-token-expiry-warnings` | Daily at 9am UTC | Warns about expiring tokens |
| `send-token-balance-low` | Daily at 10am UTC | Warns about low token balance |
| `midnight-jobs` | Daily at midnight UTC | Marks completed classes, processes packages |

---

## 🔍 Monitoring & Troubleshooting

### View All Jobs
```sql
SELECT * FROM cron.job;
```

### View Job Run History
```sql
SELECT 
  jobid,
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 50;
```

### Check for Errors
```sql
SELECT 
  jobname,
  start_time,
  status,
  return_message
FROM cron.job_run_details 
WHERE status = 'failed'
ORDER BY start_time DESC;
```

### Unschedule a Job (if needed)
```sql
SELECT cron.unschedule('job-name-here');
```

### Unschedule All Jobs (if needed)
```sql
SELECT cron.unschedule(jobid) FROM cron.job;
```

---

## ⚠️ Common Issues

### Issue 1: Jobs Not Running
**Symptoms**: No entries in `cron.job_run_details`

**Solutions**:
1. ✅ Verify `pg_cron` extension is enabled
2. ✅ Verify `pg_net` extension is enabled
3. ✅ Check if jobs are active: `SELECT active FROM cron.job;`
4. ✅ Verify your admin app URL is accessible
5. ✅ Check CRON_SECRET matches in SQL and environment variables

### Issue 2: HTTP Errors in Job History
**Symptoms**: `status = 'failed'` with HTTP error messages

**Solutions**:
1. ✅ Verify admin app URL is correct (use HTTPS)
2. ✅ Check CRON_SECRET matches exactly
3. ✅ Ensure admin app is deployed and accessible
4. ✅ Check admin app logs for errors

### Issue 3: Jobs Running But Not Working
**Symptoms**: Jobs execute but don't perform actions

**Solutions**:
1. ✅ Check admin app API logs: `/api/cron` endpoint
2. ✅ Verify database permissions
3. ✅ Check service functions for errors
4. ✅ Test jobs manually via admin UI

---

## 🔄 Updating Jobs

If you need to update a job (e.g., change schedule or URL):

1. **Unschedule the old job:**
   ```sql
   SELECT cron.unschedule('job-name-here');
   ```

2. **Create the new job:**
   ```sql
   SELECT cron.schedule(
     'job-name-here',
     'new-schedule-here',
     $$ ... $$
   );
   ```

---

## 📝 Notes

- **Time Zone**: All cron schedules use UTC time
- **Frequency Limits**: Supabase may have limits on job frequency
- **HTTP Timeout**: Jobs making HTTP calls have timeout limits
- **Cost**: pg_cron is free but HTTP calls count toward your Supabase usage

---

## ✅ Checklist

- [ ] Enabled `pg_cron` extension in Supabase
- [ ] Enabled `pg_net` extension in Supabase
- [ ] Generated and saved CRON_SECRET
- [ ] Added CRON_SECRET to admin app environment variables
- [ ] Updated migration SQL with production URL and secret
- [ ] Ran migration SQL in Supabase SQL Editor
- [ ] Verified jobs are created (6 jobs total)
- [ ] Tested jobs manually via admin UI or API
- [ ] Verified jobs are running automatically
- [ ] Set up monitoring to check job history regularly

---

## 🆘 Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Review job run history in Supabase
3. Check admin app logs for API errors
4. Verify all environment variables are set correctly

---

**Last Updated**: January 2025
