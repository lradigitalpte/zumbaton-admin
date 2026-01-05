-- Setup Storage Policies for Avatars Bucket
-- Run this file in Supabase SQL Editor
-- These policies will appear in the Dashboard after running

-- IMPORTANT: Make sure the 'avatars' bucket exists first!
-- If it doesn't exist, create it via Dashboard → Storage → New Bucket

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Policy 1: Users can upload their own avatars (INSERT)
CREATE POLICY "Users can upload their own avatars" 
ON storage.objects 
FOR INSERT 
TO public 
WITH CHECK (
  (bucket_id = 'avatars'::text) AND 
  (auth.uid()::text = split_part(split_part(name, '/', -1), '-', 1))
);

-- Policy 2: Users can update their own avatars (UPDATE)
CREATE POLICY "Users can update their own avatars" 
ON storage.objects 
FOR UPDATE 
TO public 
USING (
  (bucket_id = 'avatars'::text) AND 
  (auth.uid()::text = split_part(split_part(name, '/', -1), '-', 1))
)
WITH CHECK (
  (bucket_id = 'avatars'::text) AND 
  (auth.uid()::text = split_part(split_part(name, '/', -1), '-', 1))
);

-- Policy 3: Anyone can view avatars (SELECT) - since bucket is public
CREATE POLICY "Anyone can view avatars" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'avatars'::text);

-- Policy 4: Users can delete their own avatars (DELETE)
CREATE POLICY "Users can delete their own avatars" 
ON storage.objects 
FOR DELETE 
TO public 
USING (
  (bucket_id = 'avatars'::text) AND 
  (auth.uid()::text = split_part(split_part(name, '/', -1), '-', 1))
);

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%avatar%'
ORDER BY policyname;

