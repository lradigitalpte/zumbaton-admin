# 🔄 Hybrid Auto-Generation System for Recurring Classes

## What Changed

Your recurring class system now uses a **hybrid auto-generation approach** that keeps your database lean while classes run forever!

## How It Works

### 1. When Creating Recurring Classes
- Admin creates recurring class (e.g., "Every Monday at 2 PM")
- System generates **8 weeks** of instances initially (instead of all future ones)
- Parent class saved with date `2099-12-31` (never appears in daily queries)

### 2. Automatic Background Generation
A cron job runs **daily at 2 AM** (or manually via API):
- Checks all active recurring parent classes
- For each parent:
  - Finds the last generated instance
  - If last instance is **< 2 weeks away** → Generates **4 more weeks**
  - Otherwise skips

### 3. Continuous Operation
- Classes keep generating forever until cancelled
- Database maintains ~8-12 weeks of instances at any time
- Zero manual work required!

## Benefits

✅ **Minimal Database Storage**: 8-12 weeks instead of 52+ weeks
✅ **Open-Ended Classes**: No end date required, runs forever
✅ **Fully Automatic**: Zero admin intervention needed
✅ **Same Functionality**: Can still modify/cancel individual instances
✅ **No Parent Duplicates**: Parent classes won't appear in attendance views

## Running the Cron Job

### Automatic (Production)
Set up in Supabase using pg_cron:
```sql
-- Add to your cron setup (runs daily at 2 AM Singapore time)
SELECT cron.schedule(
  'generate-future-classes',
  '0 2 * * *',  -- 2:00 AM daily
  $$
  SELECT net.http_post(
    url := 'https://your-admin-url.vercel.app/api/cron?job=generate-future-classes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    )
  ) AS request_id;
  $$
);
```

### Manual Testing
Run via API:
```bash
# Test the auto-generation
curl -X POST "http://localhost:3001/api/cron?job=generate-future-classes" \
  -H "Authorization: Bearer your-cron-secret"

# Run all jobs including auto-generation
curl -X POST "http://localhost:3001/api/cron?job=all" \
  -H "Authorization: Bearer your-cron-secret"
```

### Check Results
The cron job returns detailed results:
```json
{
  "success": true,
  "data": {
    "totalParents": 3,
    "totalGenerated": 12,
    "results": [
      {
        "parentId": "...",
        "title": "Choreographed Dance with Steppers",
        "generated": 4
      }
    ]
  }
}
```

## Example Timeline

**Day 1 (Class Created):**
- Admin creates "Every Monday & Wednesday at 2 PM"
- System generates: Jan 6, 8, 13, 15, 20, 22, 27, 29, Feb 3, 5... (8 weeks)

**Day 7 (Cron Runs):**
- Last instance: Feb 3 (27 days away)
- Action: Skip (still > 2 weeks away)

**Day 21 (Cron Runs):**
- Last instance: Feb 3 (13 days away)
- Action: **Generate 4 more weeks** → Feb 10, 12, 17, 19, 24, 26, Mar 3, 5

**Day 35 (Cron Runs):**
- Last instance: Mar 5 (28 days away)
- Action: Skip

...continues forever until class is cancelled!

## Monitoring

### Check Active Recurring Classes
```sql
SELECT 
  id,
  title,
  scheduled_at,
  status
FROM classes
WHERE parent_class_id IS NULL
  AND recurrence_type = 'recurring'
  AND status != 'cancelled';
```

### Check Generated Instances for a Parent
```sql
SELECT 
  id,
  title,
  scheduled_at,
  status
FROM classes
WHERE parent_class_id = 'YOUR_PARENT_ID'
ORDER BY scheduled_at;
```

### Check Last Generated Date
```sql
SELECT 
  p.title as parent_title,
  MAX(c.scheduled_at) as last_generated
FROM classes p
LEFT JOIN classes c ON c.parent_class_id = p.id
WHERE p.parent_class_id IS NULL
  AND p.recurrence_type = 'recurring'
GROUP BY p.id, p.title;
```

## Troubleshooting

### Classes Not Auto-Generating?
1. Check if cron job is running:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'generate-future-classes';
   ```

2. Check cron job logs:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-future-classes')
   ORDER BY start_time DESC 
   LIMIT 10;
   ```

3. Manually trigger:
   ```bash
   curl -X POST "http://localhost:3001/api/cron?job=generate-future-classes" \
     -H "Authorization: Bearer your-cron-secret"
   ```

### Parent Class Showing in Attendance?
Parent classes should have `scheduled_at = 2099-12-31`. If old ones still appear:
```sql
-- Fix old parent classes
UPDATE classes
SET scheduled_at = '2099-12-31T00:00:00Z'
WHERE parent_class_id IS NULL
  AND recurrence_type != 'single';
```

## Files Changed

### New Files:
- `src/cron/generate-future-classes.ts` - Cron job logic
- `HYBRID_AUTO_GENERATION_GUIDE.md` - This guide

### Modified Files:
- `src/services/class.service.ts` - Added `maxWeeks` param, `generateFutureOccurrences()` function
- `src/services/scheduled-jobs.service.ts` - Added auto-generation to job list
- `src/app/api/cron/route.ts` - Added `generate-future-classes` endpoint

## Configuration

### Adjust Generation Timing
Edit `src/cron/generate-future-classes.ts`:
```typescript
// Change threshold (default: 14 days = 2 weeks)
if (daysUntilLast > 14) { // Change this number
  // Skip generation
}

// Change how many weeks to generate (default: 4)
const generated = await generateFutureOccurrences(parent.id, 4) // Change this number
```

### Initial Generation on Create
Edit `src/services/class.service.ts`:
```typescript
// Change initial generation (default: 8 weeks)
const occurrences = generateOccurrences(
  startDate,
  recurrenceType,
  recurrencePattern,
  8 // Change this number
)
```

## Need Help?

Check the logs:
```bash
# In development
npm run dev
# Watch the console for: [Cron: Auto-Generate Classes]

# In production
# Check Vercel logs or Supabase function logs
```
