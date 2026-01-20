# ✅ Cron Jobs Configuration Checklist

## 🎯 Complete Setup Checklist

Use this checklist to ensure everything is properly configured for cron jobs to work automatically.

---

## ✅ Step 1: Supabase Extensions (DONE ✅)

- [x] **pg_cron** extension enabled
- [x] **pg_net** extension enabled

**Status**: ✅ Already completed

---

## ✅ Step 2: SQL Migration (DONE ✅)

- [x] Ran `014_setup_cron_jobs.sql` in Supabase SQL Editor
- [x] All 6 jobs created successfully

**Verify with:**
```sql
SELECT * FROM cron.job;
```

**Status**: ✅ Already completed

---

## ⚠️ Step 3: Vercel Environment Variables (CRITICAL - DO THIS NOW!)

### Required Configuration:

1. **Go to Vercel Dashboard**
   - Navigate to your admin app project
   - Go to **Settings** → **Environment Variables**

2. **Add CRON_SECRET**
   - **Key**: `CRON_SECRET`
   - **Value**: `8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f`
   - **Environment**: 
     - ✅ **Production** (REQUIRED)
     - ✅ **Preview** (optional, but recommended)
     - ✅ **Development** (optional, for local testing)

3. **Save and Redeploy**
   - Click **Save**
   - Go to **Deployments** tab
   - Click **Redeploy** on the latest deployment (or push a new commit)
   - ⚠️ **IMPORTANT**: The app must be redeployed for the environment variable to take effect!

**Status**: ⚠️ **ACTION REQUIRED** - Add CRON_SECRET to Vercel and redeploy

---

## ✅ Step 4: Local Environment (DONE ✅)

- [x] CRON_SECRET added to `.env.local`
- [x] Value: `8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f`

**Status**: ✅ Already completed

---

## ✅ Step 5: API Endpoints (VERIFIED ✅)

- [x] All 8 endpoints tested and working
- [x] Authentication working correctly
- [x] No-shows endpoint verified

**Status**: ✅ All endpoints working correctly

---

## 🔍 Step 6: Verify Cron Jobs Are Running

### Check Jobs Are Scheduled:

Run in Supabase SQL Editor:
```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  nodename,
  nodeport
FROM cron.job
ORDER BY jobname;
```

**Expected**: Should see 6 jobs, all with `active = true`

### Check Job Execution History:

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

**What to look for:**
- ✅ `status = 'succeeded'` - Jobs are running successfully
- ⚠️ `status = 'failed'` - Check `return_message` for errors
- 📊 `start_time` - Shows when jobs last ran

---

## 📋 Configuration Summary

| Item | Status | Action Required |
|------|--------|----------------|
| Supabase Extensions | ✅ Done | None |
| SQL Migration | ✅ Done | None |
| **Vercel CRON_SECRET** | ⚠️ **TODO** | **Add to Vercel & Redeploy** |
| Local .env.local | ✅ Done | None |
| API Endpoints | ✅ Verified | None |
| Jobs Scheduled | ⚠️ Verify | Run SQL query above |

---

## 🚨 Critical: Vercel Configuration

**Without CRON_SECRET in Vercel, the cron jobs will fail!**

The Supabase cron jobs will try to call your admin app API, but without the correct CRON_SECRET in Vercel, the API will reject the requests.

### Quick Steps:

1. **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. **Add**:
   ```
   CRON_SECRET=8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f
   ```
3. **Select**: Production (and Preview if you want)
4. **Save**
5. **Redeploy** your app

---

## 🧪 Test After Configuration

After adding CRON_SECRET to Vercel and redeploying:

1. **Wait 5-10 minutes** for jobs to run (or check immediately)
2. **Run verification query**:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobname = 'process-no-shows' 
   ORDER BY start_time DESC 
   LIMIT 5;
   ```
3. **Check for success**: Look for `status = 'succeeded'`

---

## 📊 Monitoring Queries

### Check All Jobs Status:
```sql
SELECT 
  jobname,
  COUNT(*) as total_runs,
  COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as succeeded,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  MAX(start_time) as last_run
FROM cron.job_run_details 
WHERE start_time > NOW() - INTERVAL '24 hours'
GROUP BY jobname
ORDER BY last_run DESC;
```

### Check for Recent Failures:
```sql
SELECT 
  jobname,
  start_time,
  status,
  return_message
FROM cron.job_run_details 
WHERE status = 'failed'
  AND start_time > NOW() - INTERVAL '24 hours'
ORDER BY start_time DESC;
```

---

## ✅ Final Checklist

- [ ] CRON_SECRET added to Vercel environment variables
- [ ] App redeployed after adding CRON_SECRET
- [ ] Verified jobs are scheduled: `SELECT * FROM cron.job;`
- [ ] Checked job execution history: `SELECT * FROM cron.job_run_details;`
- [ ] Verified jobs are running successfully (status = 'succeeded')

---

## 🎯 What Happens Next

Once everything is configured:

1. **Every 15 minutes**: Class reminders & waitlist expiry run automatically
2. **Every hour**: No-shows are processed automatically
3. **Daily at 9am UTC**: Token expiry warnings sent
4. **Daily at 10am UTC**: Token balance low warnings sent
5. **Daily at midnight UTC**: Completed classes marked, packages processed

**No manual intervention needed!** 🎉

---

## 🆘 If Jobs Are Not Running

1. ✅ Verify CRON_SECRET is in Vercel (Production environment)
2. ✅ Verify app was redeployed after adding CRON_SECRET
3. ✅ Check job status: `SELECT active FROM cron.job;` (should all be `true`)
4. ✅ Check for errors: `SELECT * FROM cron.job_run_details WHERE status = 'failed';`
5. ✅ Verify admin app URL is correct in SQL: `SELECT command FROM cron.job WHERE jobname = 'process-no-shows';`
6. ✅ Check admin app logs in Vercel for API errors

---

**Last Updated**: After initial setup
**Next Action**: Add CRON_SECRET to Vercel and redeploy ⚠️
