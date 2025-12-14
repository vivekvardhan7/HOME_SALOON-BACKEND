-- ============================================
-- Verify the Fix Was Applied Successfully
-- ============================================

-- 1. Check if the new policies exist
SELECT 
  policyname,
  cmd as operation,
  roles
FROM pg_policies 
WHERE tablename = 'vendors'
AND cmd = 'INSERT'
ORDER BY policyname;

-- Expected policies:
-- - "vendors can insert their own data" (authenticated)
-- - "new users can insert vendor during signup" (anon)

-- 2. Check if the function was created
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'insert_vendor_for_new_user';

-- 3. Verify RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'vendors';

