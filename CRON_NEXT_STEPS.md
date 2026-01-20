# ✅ Next Steps After Running Cron Jobs SQL

## Step 1: Verify Jobs Were Created

Run this query in Supabase SQL Editor to verify all 6 jobs were created:

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

You should see:
- ✅ `send-class-reminders`
- ✅ `process-waitlist-expiry`
- ✅ `process-no-shows`
- ✅ `send-token-expiry-warnings`
- ✅ `send-token-balance-low`
- ✅ `midnight-jobs`

---

## Step 2: Add CRON_SECRET to Vercel (IMPORTANT!)

Your admin app needs the CRON_SECRET environment variable to authenticate the cron job requests.

### In Vercel Dashboard:

1. Go to your **Vercel Project** → **Settings** → **Environment Variables**
2. Click **Add New**
3. Add:
   - **Key**: `CRON_SECRET`
   - **Value**: `8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f`
   - **Environment**: Select **Production** (and Preview/Development if needed)
4. Click **Save**
5. **Redeploy** your app so it picks up the new environment variable

---

## Step 3: Test the Jobs Manually

### Option A: Test via Admin UI (Easiest)

1. Go to your admin app: `https://admin.zumbaton.sg/settings/cron-jobs`
2. Click **"Run All Jobs"** or test individual jobs
3. Check if they execute successfully

### Option B: Test via API

```bash
# Test all jobs
curl -X POST "https://admin.zumbaton.sg/api/cron?job=all" \
  -H "Authorization: Bearer 8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f"

# Test specific job (e.g., no-shows)
curl -X POST "https://admin.zumbaton.sg/api/cron?job=no-shows" \
  -H "Authorization: Bearer 8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f"
```

---

## Step 4: Monitor Job Execution

### Check Job Run History

Run this query in Supabase SQL Editor to see if jobs are running:

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

### What to Look For:

- ✅ **status = 'succeeded'** - Job ran successfully
- ⚠️ **status = 'failed'** - Check `return_message` for errors
- 📊 **start_time** - Shows when jobs last ran

---

## Step 5: Verify Jobs Are Running Automatically

### Wait and Check:

1. **Every 15 minutes**: Class reminders and waitlist expiry should run
2. **Every hour**: No-shows job should run (check at :00 minutes past the hour)
3. **Daily at 9am UTC**: Token expiry warnings
4. **Daily at 10am UTC**: Token balance low warnings
5. **Daily at midnight UTC**: Midnight jobs (completed classes, expired packages)

### Check After Some Time:

```sql
-- Check recent job runs (last 24 hours)
SELECT 
  jobname,
  COUNT(*) as run_count,
  MAX(start_time) as last_run,
  COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as succeeded,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM cron.job_run_details 
WHERE start_time > NOW() - INTERVAL '24 hours'
GROUP BY jobname
ORDER BY last_run DESC;
```

---

## 🎯 What Each Job Does

| Job | Frequency | What It Does |
|-----|-----------|--------------|
| **send-class-reminders** | Every 15 min | Sends reminders 2h before class |
| **process-waitlist-expiry** | Every 15 min | Expires waitlist offers after 24h |
| **process-no-shows** | Every hour | ⭐ Marks no-shows 30min after class |
| **send-token-expiry-warnings** | Daily 9am UTC | Warns about expiring tokens |
| **send-token-balance-low** | Daily 10am UTC | Warns about low balance |
| **midnight-jobs** | Daily midnight UTC | ⭐ Marks completed classes |

---

## 🆘 Troubleshooting

### Jobs Not Running?

1. ✅ Check if jobs are active:
   ```sql
   SELECT jobname, active FROM cron.job;
   ```
   All should show `active = true`

2. ✅ Check for errors:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE status = 'failed' 
   ORDER BY start_time DESC LIMIT 10;
   ```

3. ✅ Verify CRON_SECRET is set in Vercel
4. ✅ Verify admin app is deployed and accessible
5. ✅ Check admin app logs for API errors

### HTTP Errors?

- Check if `pg_net` extension is enabled
- Verify URL is correct (https://admin.zumbaton.sg)
- Verify CRON_SECRET matches exactly

---

## ✅ Checklist

- [ ] Verified 6 jobs were created in Supabase
- [ ] Added CRON_SECRET to Vercel environment variables
- [ ] Redeployed admin app to pick up CRON_SECRET
- [ ] Tested jobs manually via admin UI or API
- [ ] Verified jobs are running automatically
- [ ] Set up monitoring to check job history regularly

---

## 📊 Monitoring Schedule

**Daily Check:**
- Review job run history
- Check for any failed jobs
- Verify no-shows are being processed
- Verify completed classes are being marked

**Weekly Check:**
- Review overall job performance
- Check for patterns in failures
- Verify all scheduled jobs are running

---

**🎉 You're all set!** The cron jobs will now run automatically. The most important ones for your workflow are:
- **process-no-shows** (every hour) - Automatically marks no-shows
- **midnight-jobs** (daily) - Automatically marks completed classes

No more manual work needed! 🚀
