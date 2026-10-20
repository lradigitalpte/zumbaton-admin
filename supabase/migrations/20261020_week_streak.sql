-- Week streak: one attended class per Singapore week (Monday–Sunday).
-- last_streak_reminder_week dedupes the Friday reminder email.
-- Existing streak_current values were consecutive days, so recompute both
-- counters from attended bookings before the dashboard shows them as weeks.

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS last_streak_reminder_week DATE;

COMMENT ON COLUMN public.user_stats.last_streak_reminder_week IS
  'Monday (Asia/Singapore) of the week a streak reminder email was last sent.';

WITH attended AS (
  SELECT
    b.user_id,
    (timezone('Asia/Singapore', c.scheduled_at))::date AS class_date,
    c.scheduled_at
  FROM public.bookings b
  INNER JOIN public.classes c ON c.id = b.class_id
  WHERE b.status = 'attended'
    AND b.user_id IS NOT NULL
    AND COALESCE(b.is_trial_booking, false) = false
),
weeks AS (
  SELECT
    user_id,
    (class_date - (EXTRACT(ISODOW FROM class_date)::int - 1)) AS week_start,
    MAX(scheduled_at) AS last_at
  FROM attended
  GROUP BY user_id, (class_date - (EXTRACT(ISODOW FROM class_date)::int - 1))
),
grouped AS (
  SELECT
    user_id,
    week_start,
    last_at,
    week_start - ((ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY week_start))::int * 7) AS grp
  FROM weeks
),
runs AS (
  SELECT
    user_id,
    COUNT(*)::int AS run_length,
    MAX(week_start) AS run_end,
    MAX(last_at) AS last_at
  FROM grouped
  GROUP BY user_id, grp
),
bounds AS (
  SELECT
    (timezone('Asia/Singapore', now()))::date
      - (EXTRACT(ISODOW FROM (timezone('Asia/Singapore', now()))::date)::int - 1) AS this_week
),
agg AS (
  SELECT
    r.user_id,
    MAX(r.run_length) AS streak_longest,
    MAX(r.last_at) AS last_class_at,
    COALESCE(MAX(r.run_length) FILTER (
      WHERE r.run_end = b.this_week OR r.run_end = b.this_week - 7
    ), 0) AS streak_current
  FROM runs r
  CROSS JOIN bounds b
  GROUP BY r.user_id
)
UPDATE public.user_stats us
SET
  streak_current = COALESCE(a.streak_current, 0),
  streak_longest = COALESCE(a.streak_longest, 0),
  last_class_at = COALESCE(a.last_class_at, us.last_class_at),
  updated_at = NOW()
FROM public.user_stats src
LEFT JOIN agg a ON a.user_id = src.user_id
WHERE us.user_id = src.user_id;
