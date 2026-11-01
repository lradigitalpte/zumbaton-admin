-- Read-only database numbers for Settings → Health.
-- Only the admin server (service role) may call it.

CREATE OR REPLACE FUNCTION public.admin_system_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'connections', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()),
    'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active'),
    'max_connections', current_setting('max_connections')::int,
    'cache_hit_ratio', (
      SELECT CASE WHEN sum(blks_hit) + sum(blks_read) = 0 THEN NULL
        ELSE round(sum(blks_hit)::numeric / (sum(blks_hit) + sum(blks_read)) * 100, 2) END
      FROM pg_stat_database WHERE datname = current_database()
    ),
    'started_at', pg_postmaster_start_time(),
    'tables', COALESCE((
      SELECT jsonb_agg(t ORDER BY (t->>'bytes')::bigint DESC)
      FROM (
        SELECT jsonb_build_object(
          'name', c.relname,
          'rows', GREATEST(c.reltuples::bigint, 0),
          'bytes', pg_total_relation_size(c.oid)
        ) AS t
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 8
      ) top
    ), '[]'::jsonb),
    'storage', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('bucket', bucket_id, 'files', files, 'bytes', bytes) ORDER BY bytes DESC)
      FROM (
        SELECT bucket_id, count(*) AS files, COALESCE(sum((metadata->>'size')::bigint), 0) AS bytes
        FROM storage.objects
        GROUP BY bucket_id
      ) b
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_system_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_system_metrics() TO service_role;
