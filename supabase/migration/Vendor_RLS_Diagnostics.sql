-- ============================================
-- Diagnose Vendor RLS Issue
-- ============================================
-- Run this to check what's blocking vendor inserts
-- ============================================

-- 1. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'vendors';

-- 2. List ALL policies on vendors table
SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies 
WHERE tablename = 'vendors'
ORDER BY cmd, policyname;

-- 3. Check if there are any restrictive policies that might conflict
-- (Policies are combined with OR, so if ANY policy allows it, it should work)
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NULL AND with_check IS NULL THEN 'Permissive (allows all)'
    WHEN cmd = 'INSERT' AND with_check LIKE '%auth.uid()%' THEN 'Checks auth.uid()'
    ELSE 'Has conditions'
  END as policy_type
FROM pg_policies 
WHERE tablename = 'vendors' 
AND cmd = 'INSERT';

-- 4. Test if you can see your own auth.uid() (run this while logged in)
-- This will show NULL if you're not authenticated
SELECT 
  auth.uid() as current_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN 'NOT AUTHENTICATED - This is the problem!'
    ELSE 'Authenticated as: ' || auth.uid()::text
  END as auth_status;

-- 5. Check if there's a user profile for the authenticated user
SELECT 
  id,
  email,
  role,
  status
FROM users
WHERE id = auth.uid();

