-- =====================================================
-- COMPLETE FIX: Packages RLS Policy for Anonymous Access
-- Run this to fix packages not showing on public pages
-- =====================================================

-- Step 1: Ensure RLS is enabled on packages table
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing SELECT policies (to avoid conflicts)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT polname 
    FROM pg_policy 
    WHERE polrelid = 'public.packages'::regclass 
    AND polcmd = 'r'  -- 'r' = SELECT command
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON packages', r.polname);
  END LOOP;
END $$;

-- Step 3: Create Policy 1 - Allow ANYONE (including anonymous) to view active packages
-- This is the key policy for public pages
CREATE POLICY "Anyone can view active packages"
  ON packages FOR SELECT
  USING (is_active = true);

-- Step 4: Create Policy 2 - Allow admins to view ALL packages (including inactive)
-- This ensures admin panel works correctly
CREATE POLICY "Admins can view all packages"
  ON packages FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND 
    is_admin_or_above(auth.uid()) = true
  );

-- Step 5: Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'packages';

-- Step 6: List all policies (should show 2 SELECT policies)
SELECT 
  polname as policy_name,
  CASE polcmd 
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    ELSE polcmd::text
  END as command,
  pg_get_expr(polqual, polrelid) as using_expression
FROM pg_policy 
WHERE polrelid = 'public.packages'::regclass
ORDER BY polname;

-- Step 7: Test query (should return all active packages)
SELECT 
  id,
  name,
  package_type,
  is_active,
  token_count,
  price_cents,
  'RLS test - should see this' as test_note
FROM packages
WHERE is_active = true
ORDER BY package_type, token_count;

-- Step 8: Count packages
SELECT 
  'Total packages' as metric,
  COUNT(*) as count
FROM packages
UNION ALL
SELECT 
  'Active packages' as metric,
  COUNT(*) as count
FROM packages
WHERE is_active = true
UNION ALL
SELECT 
  'Active adult packages' as metric,
  COUNT(*) as count
FROM packages
WHERE is_active = true AND package_type IN ('adult', 'all')
UNION ALL
SELECT 
  'Active kid packages' as metric,
  COUNT(*) as count
FROM packages
WHERE is_active = true AND package_type = 'kid';

