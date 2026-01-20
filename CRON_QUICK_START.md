# ⚡ Cron Jobs Quick Start

## 🎯 What You Need

1. **Admin App URL** (production): `https://your-admin-app.vercel.app`
2. **CRON_SECRET**: A secure random string (generate with `openssl rand -hex 32`)

## 🚀 5-Minute Setup

### Step 1: Enable Extensions (Supabase Dashboard)
- Go to **Database** → **Extensions**
- Enable: `pg_cron` ✅
- Enable: `pg_net` ✅

### Step 2: Generate CRON_SECRET
```bash
openssl rand -hex 32
```
Save this value!

### Step 3: Add CRON_SECRET to Environment
- **Vercel**: Project Settings → Environment Variables
- **Local**: Add to `.env.local`:
  ```env
  CRON_SECRET=your-generated-secret-here
  ```

### Step 4: Generate SQL (Easy Way)
```bash
cd zumbaton-admin
node scripts/generate-cron-sql.js
```
This will create `supabase/migrations/014_setup_cron_jobs_ready.sql`

### Step 5: Run SQL in Supabase
1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy contents from `014_setup_cron_jobs_ready.sql`
3. Click **Run**

### Step 6: Verify
```sql
SELECT * FROM cron.job;
```
Should show 6 jobs ✅

## 📊 What Gets Scheduled?

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Class Reminders | Every 15 min | Send reminders 2h before class |
| Waitlist Expiry | Every 15 min | Expire waitlist offers |
| **No-Shows** | **Every hour** | **Mark no-shows 30min after class** |
| Token Warnings | Daily 9am UTC | Warn about expiring tokens |
| Token Balance | Daily 10am UTC | Warn about low balance |
| **Midnight Jobs** | **Daily midnight UTC** | **Mark completed classes** |

## 🔍 Check If It's Working

```sql
-- View recent job runs
SELECT 
  jobname,
  start_time,
  status,
  return_message
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

## 🆘 Troubleshooting

**Jobs not running?**
- ✅ Check extensions are enabled
- ✅ Verify URL is HTTPS (not HTTP)
- ✅ Check CRON_SECRET matches exactly
- ✅ Ensure admin app is deployed

**Need to remove all jobs?**
```sql
SELECT cron.unschedule(jobid) FROM cron.job;
```

---

📖 **Full Guide**: See `CRON_SETUP_GUIDE.md` for detailed instructions
