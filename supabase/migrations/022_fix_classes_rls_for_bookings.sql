-- =====================================================
-- MIGRATION: Fix Classes RLS Policy for User Bookings
-- Allows users to view classes they have bookings for, regardless of status
-- This fixes "Unknown Class" issue for past/completed classes
-- =====================================================

-- Create a security definer function to check bookings without RLS recursion
-- This function bypasses RLS to check if a user has a booking for a class
CREATE OR REPLACE FUNCTION user_has_booking_for_class(class_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
BEGIN
  -- Temporarily disable RLS to avoid infinite recursion
  -- This allows us to check bookings without triggering classes RLS policy
  -- VOLATILE is required because we use SET LOCAL
  SET LOCAL row_security = off;
  
  -- Check if the current user has a booking for this class
  RETURN EXISTS (
    SELECT 1 
    FROM bookings 
    WHERE bookings.class_id = class_uuid 
    AND bookings.user_id = auth.uid()
  );
END;
$$;

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can view classes" ON classes;

-- Create a new policy that allows:
-- 1. Anyone to view scheduled/in-progress classes (for browsing)
-- 2. Users to view classes they have bookings for (for viewing booking history)
-- 3. Admins to view all classes
-- Using the function to avoid RLS recursion
CREATE POLICY "Anyone can view classes"
  ON classes FOR SELECT
  USING (
    -- Allow scheduled/in-progress classes for everyone
    status IN ('scheduled', 'in-progress') 
    OR 
    -- Allow admins to see all classes
    is_admin_or_above(auth.uid())
    OR
    -- Allow users to see classes they have bookings for (regardless of status)
    -- Using function to avoid RLS recursion
    user_has_booking_for_class(id)
  );

-- Verify the policy was created
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
WHERE polrelid = 'public.classes'::regclass
AND polcmd = 'r'
ORDER BY polname;
